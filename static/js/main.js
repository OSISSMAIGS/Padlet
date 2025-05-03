// main.js

document.addEventListener('DOMContentLoaded', () => {
    // Force polling transport and increase reconnection timeout
    const socket = io({
        transports: ['polling'],
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 20000
    });

    // DOM elements
    const postForm = document.getElementById('post-form');
    const postsContainer = document.getElementById('posts-container');
    const fileInput = document.getElementById('image');
    const fileNameDisplay = document.getElementById('file-name');
    const submitBtn = document.getElementById('submit-btn');
    const createPostBtn = document.getElementById('create-post-btn');
    const popupOverlay = document.getElementById('popup-overlay');
    const closePopupBtn = document.getElementById('close-popup');
    
    // Connection status indicator
    const connectionStatus = document.createElement('div');
    connectionStatus.id = 'connection-status';
    connectionStatus.className = 'connection-status disconnected';
    connectionStatus.textContent = 'Connecting...';
    document.querySelector('header').appendChild(connectionStatus);

    function togglePopup() {
        popupOverlay.classList.toggle('active');
        document.body.style.overflow = popupOverlay.classList.contains('active')
            ? 'hidden'
            : 'auto';
        if (popupOverlay.classList.contains('active')) {
            document.getElementById('username').focus();
        }
    }

    createPostBtn.addEventListener('click', togglePopup);
    closePopupBtn.addEventListener('click', togglePopup);
    popupOverlay.addEventListener('click', (e) => {
        if (e.target === popupOverlay) togglePopup();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && popupOverlay.classList.contains('active')) {
            togglePopup();
        }
    });

    // File input
    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            fileNameDisplay.textContent = fileInput.files[0].name;
        } else {
            fileNameDisplay.textContent = 'No file chosen';
        }
    });

    // Fetch & render posts
    fetchPosts();

    postForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(postForm);
        submitBtn.disabled = true;
        submitBtn.textContent = 'Posting...';

        try {
            const res = await fetch('/api/posts', { method: 'POST', body: formData });
            if (res.ok) {
                const post = await res.json();
                console.log('Post created:', post);
                
                // Manually append the new post to DOM without waiting for socket
                appendPostToDOM(post, true);
                
                postForm.reset();
                fileNameDisplay.textContent = 'No file chosen';
                togglePopup();
            } else {
                alert('Failed to create post.');
            }
        } catch (err) {
            console.error('Error creating post:', err);
            alert('Error occurred.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Post';
        }
    });

    // Socket.IO event listeners
    socket.on('connect', () => {
        console.log('Connected to server');
        connectionStatus.className = 'connection-status connected';
        connectionStatus.textContent = 'Connected';
        setTimeout(() => {
            connectionStatus.style.opacity = '0';
        }, 3000);
    });
    
    socket.on('disconnect', () => {
        console.log('Disconnected from server');
        connectionStatus.className = 'connection-status disconnected';
        connectionStatus.textContent = 'Disconnected';
        connectionStatus.style.opacity = '1';
    });
    
    socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        connectionStatus.className = 'connection-status error';
        connectionStatus.textContent = 'Connection Error';
        connectionStatus.style.opacity = '1';
    });

    socket.on('new_post', (post) => {
        console.log('New post received via socket:', post);
        appendPostToDOM(post, true);
    });

    async function fetchPosts() {
        try {
            const res = await fetch('/api/posts');
            const posts = await res.json();
            postsContainer.innerHTML = '';
            posts.forEach((p, i) => appendPostToDOM(p, false, i));
        } catch (err) {
            console.error('Error fetching posts:', err);
        }
    }

    function getPostSizeClass(post, idx) {
        if (post.image_path && idx % 5 === 0) return 'size-2';
        if (!post.image_path && idx % 7 === 0) return 'size-2';
        return '';
    }

    function appendPostToDOM(post, isNew, idx = 0) {
        // Check if post already exists (to prevent duplicates)
        const existingPost = document.querySelector(`.post[data-id="${post.id}"]`);
        if (existingPost) {
            console.log('Post already exists, not adding duplicate:', post.id);
            return;
        }
        
        const el = document.createElement('div');
        el.className = `post ${getPostSizeClass(post, idx)} ${isNew ? 'new-post' : ''}`;
        el.setAttribute('data-id', post.id);
        
        let imgHtml = post.image_path
            ? `<img src="/static/${post.image_path}" class="post-image" alt="Post image">`
            : '';
        
        el.innerHTML = `
            <div class="post-header">
                <span class="post-author">${escapeHTML(post.username)}</span>
                <span class="post-date">${post.created_at}</span>
            </div>
            <div class="post-content">${escapeHTML(post.content)}</div>
            ${imgHtml}
        `;
        
        if (isNew) {
            postsContainer.insertBefore(el, postsContainer.firstChild);
            
            // Highlight new post with animation
            setTimeout(() => {
                el.classList.add('highlight');
                setTimeout(() => el.classList.remove('highlight'), 2000);
            }, 10);
        } else {
            postsContainer.appendChild(el);
        }
    }

    function escapeHTML(s) {
        return (s || '').toString().replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
    }
});