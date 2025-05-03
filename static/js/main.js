// main.js

document.addEventListener('DOMContentLoaded', () => {
    // Force polling transport only
    const socket = io({
        transports: ['polling']
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
                postForm.reset();
                fileNameDisplay.textContent = 'No file chosen';
                togglePopup();
            } else {
                alert('Failed to create post.');
            }
        } catch (err) {
            console.error(err);
            alert('Error occurred.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Post';
        }
    });

    socket.on('new_post', (post) => {
        appendPostToDOM(post, true);
    });

    async function fetchPosts() {
        try {
            const res = await fetch('/api/posts');
            const posts = await res.json();
            postsContainer.innerHTML = '';
            posts.forEach((p, i) => appendPostToDOM(p, false, i));
        } catch (err) {
            console.error(err);
        }
    }

    function getPostSizeClass(post, idx) {
        if (post.image_path && idx % 5 === 0) return 'size-2';
        if (!post.image_path && idx % 7 === 0) return 'size-2';
        return '';
    }

    function appendPostToDOM(post, isNew, idx = 0) {
        const el = document.createElement('div');
        el.className = `post ${getPostSizeClass(post, idx)} ${isNew ? 'new-post' : ''}`;
        let imgHtml = post.image_path
            ? `<img src="/static/${post.image_path}" class="post-image">`
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
        } else {
            postsContainer.appendChild(el);
        }
    }

    function escapeHTML(s) {
        return s.replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
    }

    socket.on('connect', () => console.log('Connected to server'));
    socket.on('disconnect', () => console.log('Disconnected from server'));
});
