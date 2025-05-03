document.addEventListener('DOMContentLoaded', () => {
    // DOM elements
    const postForm = document.getElementById('post-form');
    const postsContainer = document.getElementById('posts-container');
    const fileInput = document.getElementById('image');
    const fileNameDisplay = document.getElementById('file-name');
    const submitBtn = document.getElementById('submit-btn');
    const createPostBtn = document.getElementById('create-post-btn');
    const popupOverlay = document.getElementById('popup-overlay');
    const closePopupBtn = document.getElementById('close-popup');
    const refreshButton = document.getElementById('refresh-btn'); // Get the existing refresh button

    // Polling interval in milliseconds
    const POLLING_INTERVAL = 10000; // 10 seconds
    let lastPollTime = Date.now();
    let isPolling = false;

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
        
        const formData = new FormData(postForm);
        submitBtn.disabled = true;
        submitBtn.textContent = 'Posting...';
        
        try {
            const response = await fetch('/api/posts', {
                method: 'POST',
                body: formData,
            });
            
            if (response.ok) {
                // Clear the form
                postForm.reset();
                fileNameDisplay.textContent = 'No file chosen';
                
                // Close the popup after successful post
                togglePopup();
                
                // Refresh the page to see the new post immediately
                window.location.reload();
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
                // Update posts container with new posts
                posts.forEach(post => {
                    appendPostToDOM(post, true);
                });
                
                // Show notification to user
                showNotification(`${posts.length} new post(s) added!`);
                
                // Update last poll time
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
            
            // Clear the posts container
            postsContainer.innerHTML = '';
            
            // Add posts in the order received from server
            posts.forEach((post, index) => {
                appendPostToDOM(post, false, index);
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
        
        let imageHtml = '';
        if (post.image_path) {
            imageHtml = `<img src="/static/${post.image_path}" alt="Post image" class="post-image">`;
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