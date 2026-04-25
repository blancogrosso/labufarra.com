/**
 * Navigation Logic - La Bufarra
 * Handles mobile menu toggle and scroll effects
 */

document.addEventListener('DOMContentLoaded', () => {
    const header = document.querySelector('header');
    const navToggle = document.querySelector('.nav-toggle');
    
    if (navToggle) {
        navToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            header.classList.toggle('nav-active');
            
            // Toggle icon between list and x
            const icon = navToggle.querySelector('i');
            if (header.classList.contains('nav-active')) {
                icon.classList.remove('ph-list');
                icon.classList.add('ph-x');
            } else {
                icon.classList.remove('ph-x');
                icon.classList.add('ph-list');
            }
        });
    }

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (header.classList.contains('nav-active') && !header.contains(e.target)) {
            header.classList.remove('nav-active');
            const icon = navToggle.querySelector('i');
            if (icon) {
                icon.classList.remove('ph-x');
                icon.classList.add('ph-list');
            }
        }
    });

    // Close menu when clicking on a link
    const navLinks = document.querySelectorAll('.nav-links a');
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            header.classList.remove('nav-active');
            const icon = navToggle.querySelector('i');
            if (icon) {
                icon.classList.remove('ph-x');
                icon.classList.add('ph-list');
            }
        });
    });

    // Scroll effect (Refactored from inline scripts)
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });
});
