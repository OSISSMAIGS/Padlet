document.addEventListener('DOMContentLoaded', () => {
    // DOM elements
    const message = document.getElementById('content')
    const postForm = document.getElementById('post-form');
    const postsContainer = document.getElementById('posts-container');
    const fileInput = document.getElementById('image');
    const fileNameDisplay = document.getElementById('file-name');
    const submitBtn = document.getElementById('submit-btn');
    const createPostBtn = document.getElementById('create-post-btn');
    const popupOverlay = document.getElementById('popup-overlay');
    const closePopupBtn = document.getElementById('close-popup');
    const refreshButton = document.getElementById('refresh-btn');

    // Polling interval in milliseconds
    const POLLING_INTERVAL = 10000; // Changed to 10 seconds as commented
    let lastPollTime = Date.now();
    let isPolling = false;
    let processedPostIds = new Set(); // Track processed posts to avoid duplicates

    // Function to toggle popup form
    function togglePopup() {
        popupOverlay.classList.toggle('active');
        
        // If opening the popup, focus on the first input
        if (popupOverlay.classList.contains('active')) {
            document.getElementById('username').focus();
            // Prevent body scrolling when popup is open
            document.body.style.overflow = 'hidden';
        } else {
            // Allow body scrolling when popup is closed
            document.body.style.overflow = 'auto';
        }
    }

    // Event listeners for opening/closing popup
    createPostBtn.addEventListener('click', togglePopup);
    closePopupBtn.addEventListener('click', togglePopup);
    
    // Close popup when clicking outside the form
    popupOverlay.addEventListener('click', (e) => {
        if (e.target === popupOverlay) {
            togglePopup();
        }
    });
    
    // Close popup with ESC key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && popupOverlay.classList.contains('active')) {
            togglePopup();
        }
    });

    // Event listener for file selection
    fileInput.addEventListener('change', (e) => {
        if (fileInput.files.length > 0) {
            fileNameDisplay.textContent = fileInput.files[0].name;
        } else {
            fileNameDisplay.textContent = 'No file chosen';
        }
    });

    // Fetch existing posts when the page loads
    fetchPosts();

    // Start polling for new posts
    startPolling();

    // Handle form submission
    postForm.addEventListener('submit', async (e) => {
        e.preventDefault();
    
        const hasText = message.value.trim() !== "";
        const hasImage = fileInput.files.length > 0;
    
        // Jika ada teks atau ada gambar, baru submit.
        if (hasText || hasImage) {
            const formData = new FormData(postForm);
            submitBtn.disabled = true;
            submitBtn.textContent = 'Posting...';
    
            try {
                const response = await fetch('/api/posts', {
                    method: 'POST',
                    body: formData,
                });
    
                if (response.ok) {
                    const newPost = await response.json();
                    
                    // Add the new post to processed IDs to avoid duplication
                    processedPostIds.add(newPost.id);
                    
                    // Add the new post to DOM immediately
                    appendPostToDOM(newPost, true);
                    
                    // Reset form and close popup
                    postForm.reset();
                    fileNameDisplay.textContent = 'No file chosen';
                    togglePopup();
                    
                    // Update lastPollTime to prevent re-fetching this post
                    lastPollTime = Date.now();
                    
                    // REMOVED: window.location.reload() - this was causing the bug
                } else {
                    alert('Failed to create post. Please try again.');
                }
            } catch (error) {
                console.error('Error:', error);
                alert('An error occurred. Please try again.');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Post';
            }
        } else {
            alert('Message not filled');
        }
    });

    // Function to start polling for new posts
    function startPolling() {
        setInterval(() => {
            if (!isPolling && !popupOverlay.classList.contains('active')) {
                pollForNewPosts();
            }
        }, POLLING_INTERVAL);
    }

    // Function to poll for new posts
    async function pollForNewPosts() {
        isPolling = true;
        try {
            const response = await fetch(`/api/posts?since=${lastPollTime}`);
            const posts = await response.json();
            
            if (posts.length > 0) {
                let newPostsCount = 0;
                
                // Filter out posts that have already been processed
                const trulyNewPosts = posts.filter(post => !processedPostIds.has(post.id));
                
                if (trulyNewPosts.length > 0) {
                    // Update posts container with new posts
                    trulyNewPosts.forEach(post => {
                        appendPostToDOM(post, true);
                        processedPostIds.add(post.id); // Track this post
                        newPostsCount++;
                    });
                    
                    // Show notification to user only for truly new posts
                    if (newPostsCount > 0) {
                        showNotification(`${newPostsCount} new post(s) added!`);
                    }
                }
                
                // Update last poll time regardless of whether posts were new
                lastPollTime = Date.now();
            }
        } catch (error) {
            console.error('Error polling for posts:', error);
        } finally {
            isPolling = false;
        }
    }

    // Function to show notification
    function showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        document.body.appendChild(notification);
        
        // Remove notification after 3 seconds
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 500);
        }, 3000);
    }

    // Function to fetch existing posts
    async function fetchPosts() {
        try {
            const response = await fetch('/api/posts');
            const posts = await response.json();
            
            // Clear the posts container and processed IDs
            postsContainer.innerHTML = '';
            processedPostIds.clear();
            
            // Add posts in the order received from server
            posts.forEach((post, index) => {
                appendPostToDOM(post, false, index);
                processedPostIds.add(post.id); // Track existing posts
            });
            
            // Update last poll time after initial fetch
            lastPollTime = Date.now();
        } catch (error) {
            console.error('Error fetching posts:', error);
        }
    }

    // Function to determine post size class
    function getPostSizeClass(post, index) {
        // Posts with images are occasionally double-width
        if (post.image_path && index % 5 === 0) {
            return 'size-2';
        }
        
        // Some text posts are also double-width for visual variation
        if (!post.image_path && index % 7 === 0) {
            return 'size-2';
        }
        
        return '';
    }

    // Function to add a post to the DOM
    function appendPostToDOM(post, isNew, index = 0) {
        const postElement = document.createElement('div');
        const sizeClass = getPostSizeClass(post, index);
        
        postElement.className = `post ${sizeClass} ${isNew ? 'new-post' : ''}`;
        postElement.setAttribute('data-post-id', post.id); // Add unique identifier
        
        let imageHtml = '';
        if (post.image_path) {
            imageHtml = `<img src="/static/${post.image_path}" alt="Post image" class="post-image">`;
        }
        if (post.username.length > 13){
            post.username = post.username.slice(0, 13) + "..."
        }
        
        postElement.innerHTML = `
            <div class="post-header">   
                <span class="post-author">${escapeHTML(post.username || 'Anonymous')}</span>
                <span class="post-date">${post.created_at}</span>
            </div>
            <div class="post-content">${escapeHTML(post.content)}</div>
            ${imageHtml}
        `;
        
        // For new posts, add at the beginning of container
        if (isNew) {
            postsContainer.insertBefore(postElement, postsContainer.firstChild);
            postElement.className += " newanim"
        } else {
            postsContainer.appendChild(postElement);
        }
        
        return postElement;
    }

    // Helper function to escape HTML
    function escapeHTML(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Add event listener to the existing refresh button
    refreshButton.addEventListener('click', async () => {
        refreshButton.classList.add('rotating');
        await fetchPosts();
        setTimeout(() => {
            refreshButton.classList.remove('rotating');
        }, 1000);
    });
});