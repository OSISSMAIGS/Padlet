document.addEventListener('DOMContentLoaded', () => {
    // Konfigurasi koneksi Socket.IO
    const socket = io(window.location.origin, {
        transports: ['polling'],
        path: '/socket.io',
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 3000
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

    // Fungsi toggle popup
    function togglePopup() {
        popupOverlay.classList.toggle('active');
        document.body.style.overflow = popupOverlay.classList.contains('active') 
            ? 'hidden' 
            : 'auto';
        if (popupOverlay.classList.contains('active')) {
            document.getElementById('username').focus();
        }
    }

    // Event listeners untuk UI
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

    // File input handler
    fileInput.addEventListener('change', () => {
        fileNameDisplay.textContent = fileInput.files[0]?.name || 'No file chosen';
    });

    // Initial fetch posts
    fetchPosts();

    // Form submission handler
    postForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(postForm);
        submitBtn.disabled = true;
        submitBtn.textContent = 'Posting...';

        try {
            const res = await fetch('/api/posts', {
                method: 'POST',
                body: formData
            });
            
            if (res.ok) {
                postForm.reset();
                fileNameDisplay.textContent = 'No file chosen';
                togglePopup();
                // Fallback jika socket gagal
                setTimeout(fetchPosts, 1000);
            } else {
                alert('Gagal membuat post: ' + await res.text());
            }
        } catch (err) {
            console.error('Error submission:', err);
            alert('Terjadi kesalahan jaringan');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Post';
        }
    });

    // Socket.io handlers
    socket.on('new_post', (post) => {
        appendPostToDOM(post, true);
    });

    socket.on('connect', () => {
        console.log('Terhubung ke server');
    });

    socket.on('disconnect', () => {
        console.log('Terputus dari server');
    });

    socket.on('connect_error', (err) => {
        console.error('Kesalahan koneksi:', err);
    });

    // Fungsi fetch posts
    async function fetchPosts() {
        try {
            const res = await fetch('/api/posts');
            const posts = await res.json();
            postsContainer.innerHTML = '';
            
            // Urutkan post terbaru di atas
            posts.forEach((p, i) => appendPostToDOM(p, false, i));
        } catch (err) {
            console.error('Gagal memuat posts:', err);
        }
    }

    // Fungsi menentukan ukuran post
    function getPostSizeClass(post, idx) {
        if (post.image_path && idx % 5 === 0) return 'size-2';
        if (!post.image_path && idx % 7 === 0) return 'size-2';
        return '';
    }

    // Fungsi menambahkan post ke DOM
    function appendPostToDOM(post, isNew, idx = 0) {
        const el = document.createElement('div');
        el.className = `post ${getPostSizeClass(post, idx)} ${isNew ? 'new-post' : ''}`;
        
        const imgHtml = post.image_path 
            ? `<img src="/static/${post.image_path}" class="post-image" loading="lazy">` 
            : '';
        
        el.innerHTML = `
            <div class="post-header">
                <span class="post-author">${escapeHTML(post.username)}</span>
                <span class="post-date">${post.created_at}</span>
            </div>
            <div class="post-content">${escapeHTML(post.content)}</div>
            ${imgHtml}
        `;

        // Tambahkan post baru di atas
        if (isNew) {
            postsContainer.insertBefore(el, postsContainer.firstChild);
        } else {
            postsContainer.appendChild(el);
        }
    }

    // Fungsi escape HTML
    function escapeHTML(s) {
        return s.replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
    }
});