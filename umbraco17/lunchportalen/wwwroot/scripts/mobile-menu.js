(function () {
    function init() {
        var toggle = document.querySelector('.lp-hamburger');
        var header = document.querySelector('.lp-header');
        var menu   = document.querySelector('.lp-mobile-menu');

        console.log('Mobile menu init:', { toggle, header, menu });

        if (!toggle || !header || !menu) {
            console.warn('Mobile menu: mangler elementer');
            return;
        }

        function closeMenu() {
            toggle.setAttribute('aria-expanded', 'false');
            toggle.setAttribute('aria-label', 'Åpne meny');
            header.classList.remove('is-menu-open');
            menu.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('lp-menu-open');
        }

        function openMenu() {
            toggle.setAttribute('aria-expanded', 'true');
            toggle.setAttribute('aria-label', 'Lukk meny');
            header.classList.add('is-menu-open');
            menu.setAttribute('aria-hidden', 'false');
            document.body.classList.add('lp-menu-open');
        }

        toggle.addEventListener('click', function () {
            console.log('Hamburger klikket');
            var isOpen = toggle.getAttribute('aria-expanded') === 'true';
            isOpen ? closeMenu() : openMenu();
        });

        menu.querySelectorAll('a').forEach(function (link) {
            link.addEventListener('click', closeMenu);
        });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') closeMenu();
        });

        document.addEventListener('click', function (e) {
            if (!header.contains(e.target)) closeMenu();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();