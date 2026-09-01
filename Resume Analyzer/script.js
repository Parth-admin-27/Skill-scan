// ============================
// Mobile Nav Menu
// ============================
function handleMenu() {
    const navDialog = document.getElementById('nav-dialog');
    navDialog.classList.toggle('hidden');
}

// ============================
// Scroll-triggered animations
// ============================
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
});

document.querySelectorAll('.animate-on-scroll').forEach(el => {
    observer.observe(el);
});

// ============================
// Animated counters
// ============================
function animateCounter(element) {
    const target = parseInt(element.getAttribute('data-target'));
    const suffix = element.getAttribute('data-suffix') || '+';
    const duration = 2000;
    const start = 0;
    const startTime = performance.now();

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.floor(start + (target - start) * eased);

        if (target >= 1000) {
            element.textContent = current.toLocaleString() + suffix;
        } else {
            element.textContent = current + suffix;
        }

        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }

    requestAnimationFrame(update);
}

// Trigger counters when stats section is visible
const statsSection = document.getElementById('stats');
if (statsSection) {
    let countersStarted = false;
    const statsObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !countersStarted) {
                countersStarted = true;
                document.querySelectorAll('.stat-number').forEach(el => {
                    animateCounter(el);
                });
            }
        });
    }, { threshold: 0.3 });
    statsObserver.observe(statsSection);
}

// ============================
// FAQ Accordion
// ============================
const dtElements = document.querySelectorAll('dt');
dtElements.forEach(element => {
    element.addEventListener('click', () => {
        const ddId = element.getAttribute('aria-controls');
        const ddElement = document.getElementById(ddId);
        const ddArrowIcon = element.querySelector('i');

        ddElement.classList.toggle('hidden');
        if (ddArrowIcon) {
            ddArrowIcon.classList.toggle('rotate-180');
        }
    });
});

// ============================
// Go to top button
// ============================
const goTopBtn = document.getElementById('goTopBtn');
if (goTopBtn) {
    window.addEventListener('scroll', () => {
        if (window.scrollY > 500) {
            goTopBtn.classList.add('show');
        } else {
            goTopBtn.classList.remove('show');
        }
    });

    goTopBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}