/* ==========================================================================
   CONSTRUCCIONES MARTINEZ
   Lógica de interacción y animación (JavaScript vanilla).
   Única dependencia: vendor/lenis.min.js (scroll suave, alojado en el proyecto).
   Si no carga, la página funciona igual con scroll nativo.

   ÍNDICE
   00. Configuración del negocio (EDITAR)
   01. Utilidades
   02. Enlaces de contacto (WhatsApp, teléfono, correo)
   03. Loader con progreso
   04. Scroll suave y anclas
   05. Header, indicador de navegación, menú móvil
   06. Revelado al hacer scroll, titulares por palabra, imágenes
   07. Hero: rotador de verbos
   08. Servicios (paneles que se expanden)
   09. Contadores
   10. Bucle de scroll (progreso, header, hero, parallax, manifiesto,
       franja de marca, sellos, proceso, etapas)
   11. Preguntas frecuentes
   12. Galería: filtros y visor de fotos
   13. Cotizador guiado de 3 pasos
   14. Botón flotante de WhatsApp
   15. Arranque

   NOTA DE RENDIMIENTO: no se usa addEventListener('scroll'). Un único
   requestAnimationFrame compara window.scrollY y solo escribe en el DOM cuando
   cambió algo, separando lecturas y escrituras para evitar reflows forzados.
   ========================================================================== */
'use strict';

(() => {

    /* ======================================================================
       00. CONFIGURACIÓN DEL NEGOCIO
       EDITAR: este es el único lugar donde se cambia el número de WhatsApp,
       el teléfono visible y el correo. Todos los botones y enlaces del sitio
       se actualizan solos.
    ====================================================================== */
    const CONFIG = {
        brand: 'Construcciones Martinez',
        whatsapp: '5214464949247',       // país + número, sin "+" ni espacios (WhatsApp en México usa 521 + 10 dígitos)
        phoneDisplay: '(446) 494 9247',  // cómo se muestra el teléfono en la página
        email: 'contacto@tudominio.com'
    };

    /* ======================================================================
       01. UTILIDADES
    ====================================================================== */
    const $ = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
    const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
    const root = document.documentElement;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const desktop = window.matchMedia('(min-width: 1024px)');

    /* Ejecuta un módulo de forma aislada: si uno falla, el resto sigue vivo */
    const safe = (fn, name) => {
        try { return fn(); }
        catch (err) { console.error('[' + (name || fn.name) + ']', err); return null; }
    };

    const waLink = (msg) =>
        'https://wa.me/' + CONFIG.whatsapp + '?text=' + encodeURIComponent(msg);

    const icon = (name) =>
        '<svg class="ic" aria-hidden="true" focusable="false"><use href="#i-' + name + '"/></svg>';

    let lenis = null;          // instancia de scroll suave (si está disponible)
    let holdHeaderUntil = 0;   // mantiene visible el header mientras viaja un ancla

    /* ======================================================================
       02. ENLACES DE CONTACTO
    ====================================================================== */
    function initContactLinks() {
        $$('[data-wa]').forEach((a) => {
            a.href = waLink(a.dataset.waMsg || 'Hola, quiero información sobre sus servicios.');
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
        });
        // Para llamadas se usa +52 y los 10 dígitos (sin el "1" que solo exige WhatsApp)
        $$('[data-tel]').forEach((a) => { a.href = 'tel:+52' + CONFIG.whatsapp.slice(-10); });
        $$('[data-phone-text]').forEach((el) => { el.textContent = CONFIG.phoneDisplay; });
        $$('[data-email]').forEach((a) => { a.href = 'mailto:' + CONFIG.email; });
        $$('[data-email-text]').forEach((el) => { el.textContent = CONFIG.email; });
        const year = $('#year');
        if (year) year.textContent = new Date().getFullYear();

    }

    /* ======================================================================
       03. LOADER
       Progreso suave 0 a 100 sobre un telón guinda. Termina cuando la página
       cargó, la imagen del hero está decodificada y pasó un tiempo mínimo
       para que la animación se aprecie. Después el telón sube en dos capas.
    ====================================================================== */
    function initLoader() {
        return new Promise((resolve) => {
            const loader = $('#loader');
            const count = $('#loaderCount');

            if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
            if (!location.hash) window.scrollTo(0, 0);

            if (!loader) { root.classList.remove('is-loading'); root.classList.add('is-ready'); resolve(); return; }

            const MIN_TIME = reduceMotion ? 400 : 1900;
            const MAX_TIME = 6500;                       // salida de emergencia
            const t0 = performance.now();
            let pageReady = document.readyState === 'complete';
            let imgReady = false;
            let shown = 0;
            let finished = false;

            if (!pageReady) window.addEventListener('load', () => { pageReady = true; }, { once: true });

            const heroImg = $('.hero-img');
            if (heroImg && heroImg.decode) heroImg.decode().then(() => { imgReady = true; }, () => { imgReady = true; });
            else imgReady = true;

            const finish = () => {
                if (finished) return;
                finished = true;
                if (count) count.textContent = '100';
                loader.style.setProperty('--p', '1');
                loader.classList.add('is-done');
                root.classList.remove('is-loading');
                root.classList.add('is-ready');
                if (lenis) lenis.start();
                setTimeout(() => { loader.hidden = true; }, 2100);
                resolve();
            };

            const tick = (now) => {
                if (finished) return;
                const elapsed = now - t0;
                const timeP = clamp(elapsed / MIN_TIME);
                const eased = 1 - Math.pow(1 - timeP, 3);
                const ready = pageReady && imgReady;
                // Mientras la página no esté lista, el progreso se detiene en 92
                const target = (ready ? eased : Math.min(eased, .92)) * 100;
                shown += (target - shown) * .14;

                if (ready && timeP >= 1 && shown > 99.2) { finish(); return; }
                if (elapsed > MAX_TIME) { finish(); return; }

                if (count) count.textContent = String(Math.round(shown));
                loader.style.setProperty('--p', (shown / 100).toFixed(4));
                requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
        });
    }

    /* ======================================================================
       04. SCROLL SUAVE Y ANCLAS
    ====================================================================== */
    function initSmoothScroll() {
        if (reduceMotion || typeof window.Lenis !== 'function') return;
        lenis = new window.Lenis({ lerp: 0.09, wheelMultiplier: 0.95, smoothWheel: true });
        lenis.stop();                                   // se activa al terminar el loader
    }

    function scrollToTarget(target, immediate) {
        const headerH = ($('#siteHeader') || { offsetHeight: 76 }).offsetHeight;
        holdHeaderUntil = performance.now() + 2000;
        if (lenis) {
            lenis.start();
            lenis.scrollTo(target, {
                offset: -(headerH - 1), duration: immediate ? 0 : 1.7, immediate: !!immediate,
                easing: (t) => 1 - Math.pow(1 - t, 4)
            });
        } else {
            target.scrollIntoView({ behavior: reduceMotion || immediate ? 'auto' : 'smooth' });
        }
    }

    function scrollToY(y) {
        holdHeaderUntil = performance.now() + 1600;
        if (lenis) { lenis.start(); lenis.scrollTo(y, { duration: 1.3, easing: (t) => 1 - Math.pow(1 - t, 4) }); }
        else window.scrollTo({ top: y, behavior: reduceMotion ? 'auto' : 'smooth' });
    }

    function initAnchors() {
        document.addEventListener('click', (e) => {
            const a = e.target.closest('a[href^="#"]');
            if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey) return;
            const id = a.getAttribute('href').slice(1);
            if (!id) return;
            const target = document.getElementById(id);
            if (!target) return;
            e.preventDefault();
            scrollToTarget(target);
            history.replaceState(null, '', '#' + id);
        });
    }

    /* ======================================================================
       05. HEADER, INDICADOR DE NAVEGACIÓN, MENÚ MÓVIL
    ====================================================================== */
    function initHeader() {
        const header = $('#siteHeader');
        const sentinel = $('#topSentinel');
        if (!header || !sentinel || !('IntersectionObserver' in window)) return;
        new IntersectionObserver(([entry]) => {
            header.classList.toggle('is-scrolled', !entry.isIntersecting);
        }).observe(sentinel);
    }

    let refreshNavPill = () => {};

    /* Línea guinda que se desliza hacia el enlace activo o bajo el cursor */
    function initNavPill() {
        const nav = $('#nav');
        const pill = $('#navPill');
        const list = $('#navList');
        if (!nav || !pill || !list) return;
        const links = $$('a', list);
        let placed = false;

        const place = (a) => {
            if (!a) { pill.classList.remove('is-on'); return; }
            const nr = nav.getBoundingClientRect();
            const r = a.getBoundingClientRect();
            if (!nr.width) return;
            if (!placed) {                              // primera vez: sin deslizar desde el borde
                pill.style.transition = 'none';
                pill.style.setProperty('--x', (r.left - nr.left) + 'px');
                pill.style.setProperty('--w', r.width + 'px');
                void pill.offsetWidth;
                pill.style.transition = '';
                placed = true;
            } else {
                pill.style.setProperty('--x', (r.left - nr.left) + 'px');
                pill.style.setProperty('--w', r.width + 'px');
            }
            pill.classList.add('is-on');
        };
        const current = () => links.find((a) => a.getAttribute('aria-current') === 'true') || null;

        links.forEach((a) => {
            a.addEventListener('pointerenter', () => place(a));
            a.addEventListener('focus', () => place(a));
            a.addEventListener('blur', () => place(current()));
        });
        list.addEventListener('pointerleave', () => place(current()));
        window.addEventListener('resize', () => place(current()));
        refreshNavPill = () => place(current());
    }

    function initMenu() {
        const btn = $('#menuToggle');
        const menu = $('#mobileMenu');
        if (!btn || !menu) return;

        const open = () => {
            menu.hidden = false;
            requestAnimationFrame(() => requestAnimationFrame(() => menu.classList.add('is-open')));
            btn.setAttribute('aria-expanded', 'true');
            btn.setAttribute('aria-label', 'Cerrar menú');
            root.style.overflow = 'hidden';
            root.classList.add('menu-open');
            const header = $('#siteHeader');
            if (header) header.classList.remove('is-hidden');
            if (lenis) lenis.stop();
        };
        const close = () => {
            if (btn.getAttribute('aria-expanded') !== 'true') return;
            menu.classList.remove('is-open');
            btn.setAttribute('aria-expanded', 'false');
            btn.setAttribute('aria-label', 'Abrir menú');
            root.style.overflow = '';
            root.classList.remove('menu-open');
            if (lenis) lenis.start();
            setTimeout(() => { if (!menu.classList.contains('is-open')) menu.hidden = true; }, 900);
        };

        btn.addEventListener('click', () => {
            btn.getAttribute('aria-expanded') === 'true' ? close() : open();
        });
        $$('a', menu).forEach((a) => a.addEventListener('click', close));
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true') { close(); btn.focus(); }
        });
        desktop.addEventListener('change', (e) => { if (e.matches) close(); });
    }

    function initActiveNav() {
        if (!('IntersectionObserver' in window)) return;
        const links = $$('.nav-list a');
        const byId = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
        const io = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                const link = byId.get(entry.target.id);
                if (!link) return;
                if (entry.isIntersecting) {
                    links.forEach((l) => l.removeAttribute('aria-current'));
                    link.setAttribute('aria-current', 'true');
                } else {
                    link.removeAttribute('aria-current');
                }
            });
            refreshNavPill();
        }, { rootMargin: '-45% 0px -50% 0px' });
        byId.forEach((_, id) => { const sec = document.getElementById(id); if (sec) io.observe(sec); });
    }

    /* ======================================================================
       06. REVELADO AL HACER SCROLL
       Los elementos del hero (data-hero) se revelan al terminar el loader.
    ====================================================================== */

    /* Divide los titulares [data-split] en palabras para animarlas una a una.
       El texto original queda como aria-label para lectores de pantalla. */
    function initSplit() {
        $$('[data-split]').forEach((el) => {
            el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
            let n = 0;
            const walk = (node) => {
                Array.from(node.childNodes).forEach((child) => {
                    if (child.nodeType === 3) {
                        const frag = document.createDocumentFragment();
                        child.textContent.split(/(\s+)/).forEach((part) => {
                            if (!part) return;
                            if (/^\s+$/.test(part)) { frag.append(' '); return; }
                            const outer = document.createElement('span');
                            outer.className = 'sw';
                            outer.setAttribute('aria-hidden', 'true');
                            const inner = document.createElement('span');
                            inner.className = 'sw-i';
                            inner.style.setProperty('--i', String(n++));
                            inner.textContent = part;
                            outer.append(inner);
                            frag.append(outer);
                        });
                        node.replaceChild(frag, child);
                    } else if (child.nodeType === 1 && child.tagName !== 'BR') {
                        walk(child);
                    }
                });
            };
            walk(el);
        });
    }

    function initReveal() {
        // Retraso escalonado para hijos de contenedores [data-stagger]
        $$('[data-stagger]').forEach((group) => {
            $$(':scope > .reveal', group).forEach((el, i) => el.style.setProperty('--d', String(i * 90)));
        });

        const targets = $$('.reveal, .wipe, [data-split]').filter((el) => !el.hasAttribute('data-hero'));
        if (reduceMotion || !('IntersectionObserver' in window)) {
            targets.forEach((el) => el.classList.add('is-in'));
            return;
        }
        const io = new IntersectionObserver((entries, observer) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('is-in');
                observer.unobserve(entry.target);
            });
        }, { threshold: .12, rootMargin: '0px 0px -8% 0px' });
        targets.forEach((el) => io.observe(el));
    }

    function playHeroIntro() {
        $$('[data-hero]').forEach((el) => el.classList.add('is-in'));
    }

    /* Las fotos aparecen con un fundido cuando terminan de cargar */
    function initImages() {
        $$('img[data-fade]').forEach((img) => {
            const done = () => img.classList.add('is-loaded');
            if (img.complete && img.naturalWidth) done();
            else {
                img.addEventListener('load', done, { once: true });
                img.addEventListener('error', done, { once: true });
            }
        });
    }

    /* ======================================================================
       07. HERO: ROTADOR DE VERBOS
    ====================================================================== */
    function initRotator() {
        const words = $$('.rot-word');
        if (words.length < 2 || reduceMotion) return;
        let i = 0;
        setInterval(() => {
            if (document.hidden) return;
            const current = words[i];
            i = (i + 1) % words.length;
            const next = words[i];
            current.classList.remove('is-active');
            current.classList.add('is-leaving');
            next.classList.remove('is-leaving');
            requestAnimationFrame(() => next.classList.add('is-active'));
            setTimeout(() => current.classList.remove('is-leaving'), 950);
        }, 2900);
    }

    /* ======================================================================
       08. SERVICIOS: PANELES QUE SE EXPANDEN
       En escritorio el panel activo se abre (clic, foco o cursor encima).
       En móvil y tableta todos los paneles se muestran abiertos.
    ====================================================================== */
    function initServices() {
        const list = $('#svcList');
        if (!list) return;
        const items = $$('.svc', list);
        const set = (it) => {
            items.forEach((i) => {
                const on = i === it;
                i.classList.toggle('is-active', on);
                const hit = $('.svc-hit', i);
                if (hit) hit.setAttribute('aria-expanded', String(on));
            });
        };
        items.forEach((it) => {
            const hit = $('.svc-hit', it);
            if (hit) {
                hit.addEventListener('click', () => set(it));
                hit.addEventListener('focus', () => set(it));
            }
            if (finePointer) it.addEventListener('pointerenter', () => { if (desktop.matches) set(it); });
        });
    }

    /* ======================================================================
       09. CONTADORES
       El HTML ya trae el valor final (SEO y sin JS). Aquí se anima de 0 al
       valor cuando la sección entra en pantalla.
    ====================================================================== */
    function initCounters() {
        const els = $$('.count');
        if (!els.length || reduceMotion || !('IntersectionObserver' in window)) return;

        const format = (el, value) => (el.dataset.prefix || '') + value + (el.dataset.suffix || '');
        els.forEach((el) => { el.textContent = format(el, 0); });

        const run = (el) => {
            const target = Number(el.dataset.count) || 0;
            const duration = 2100;
            const t0 = performance.now();
            const tick = (now) => {
                const t = clamp((now - t0) / duration);
                const eased = 1 - Math.pow(1 - t, 4);
                el.textContent = format(el, Math.round(target * eased));
                if (t < 1) requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
        };

        const io = new IntersectionObserver((entries, observer) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                run(entry.target);
                observer.unobserve(entry.target);
            });
        }, { threshold: .6 });
        els.forEach((el) => io.observe(el));
    }

    /* ======================================================================
       10. BUCLE DE SCROLL
       Cada módulo expone read(s) (solo lecturas) y write(s, datos) (solo
       escrituras). write devuelve true si necesita seguir animando aunque el
       scroll se detenga. El mismo bucle alimenta a Lenis.
    ====================================================================== */
    function createLoop(modules) {
        let lastY = -1, lastW = 0, lastH = 0, busy = true;
        const frame = (time) => {
            if (lenis) lenis.raf(time);
            const y = window.scrollY, w = window.innerWidth, h = window.innerHeight;
            if (y !== lastY || w !== lastW || h !== lastH || busy) {
                lastY = y; lastW = w; lastH = h;
                const state = { y, w, h };
                const reads = modules.map((m) => (m.read ? m.read(state) : null));
                busy = false;
                modules.forEach((m, i) => { if (m.write && m.write(state, reads[i])) busy = true; });
            }
            requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
    }

    /* 10.a Barra de progreso de lectura */
    function progressModule() {
        const bar = $('#progressBar');
        if (!bar) return null;
        let max = 1;
        const measure = () => { max = Math.max(1, root.scrollHeight - window.innerHeight); };
        measure();
        window.addEventListener('resize', measure);
        if ('ResizeObserver' in window) new ResizeObserver(measure).observe(document.body);
        return {
            read: (s) => clamp(s.y / max),
            write: (s, p) => { bar.style.transform = 'scaleX(' + p.toFixed(4) + ')'; }
        };
    }

    /* 10.b El header se oculta al bajar y reaparece al subir */
    function headerModule() {
        const header = $('#siteHeader');
        if (!header) return null;
        let lastY = 0, hidden = false;
        const setHidden = (v) => { if (v !== hidden) { hidden = v; header.classList.toggle('is-hidden', v); } };
        return {
            read: (s) => s.y,
            write: (s, y) => {
                if (performance.now() < holdHeaderUntil || root.classList.contains('menu-open')) { setHidden(false); lastY = y; return false; }
                const dy = y - lastY;
                if (Math.abs(dy) < 6) return false;
                setHidden(y > 560 && dy > 0);
                lastY = y;
                return false;
            }
        };
    }

    /* 10.c El hero baja más lento que la página y su texto se desvanece */
    function heroModule() {
        const hero = $('#inicio');
        const inner = $('#heroInner');
        const media = $('#heroMedia');
        if (!hero || !inner || !media || reduceMotion) return null;
        let heroH = hero.offsetHeight;
        window.addEventListener('resize', () => { heroH = hero.offsetHeight; });
        let lastP = -1;
        return {
            read: (s) => clamp(s.y / heroH),
            write: (s, p) => {
                if (p === lastP) return false;
                lastP = p;
                media.style.transform = p === 0 ? '' : 'translate3d(0,' + (p * heroH * .22).toFixed(1) + 'px,0)';
                const q = clamp(p / .78);
                inner.style.opacity = q === 0 ? '' : (1 - q).toFixed(3);
                inner.style.transform = q === 0 ? '' : 'translate3d(0,' + (q * -64).toFixed(1) + 'px,0)';
                return false;
            }
        };
    }

    /* 10.d Parallax suave en imágenes marcadas con data-parallax */
    function parallaxModule() {
        if (reduceMotion) return null;
        const items = $$('[data-parallax]').map((img) => ({
            img, speed: parseFloat(img.dataset.parallax) || 0.05, box: img.parentElement
        }));
        if (!items.length) return null;
        return {
            read: (s) => items.map((it) => {
                const r = it.box.getBoundingClientRect();
                if (r.bottom < -120 || r.top > s.h + 120) return null;
                return clamp((r.top + r.height / 2 - s.h / 2) / s.h, -1, 1);
            }),
            write: (s, offsets) => {
                offsets.forEach((v, i) => {
                    if (v === null) return;
                    items[i].img.style.translate = '0 ' + (v * items[i].speed * -300).toFixed(1) + 'px';
                });
            }
        };
    }

    /* 10.e Manifiesto: las palabras se iluminan al avanzar el scroll */
    function manifestoModule() {
        const el = $('#manifestoText');
        const wrap = $('#manifestoWrap');
        if (!el || reduceMotion) return null;

        const text = el.textContent.trim().replace(/\s+/g, ' ');
        const words = text.split(' ');
        const plain = words.map((w) => w.toLowerCase().replace(/[.,;:]/g, ''));
        const accentPhrases = ['plan claro', 'materiales de primera', 'vuelve a llamarnos'];
        const accentIdx = new Set();
        accentPhrases.forEach((phrase) => {
            const parts = phrase.split(' ');
            for (let i = 0; i <= plain.length - parts.length; i++) {
                if (parts.every((p, j) => plain[i + j] === p)) parts.forEach((_, j) => accentIdx.add(i + j));
            }
        });

        // El texto original queda en un span solo para lectores de pantalla
        el.textContent = '';
        const sr = document.createElement('span');
        sr.className = 'sr-only';
        sr.textContent = text;
        const visual = document.createElement('span');
        visual.setAttribute('aria-hidden', 'true');
        const spans = words.map((w, i) => {
            const span = document.createElement('span');
            span.className = 'w' + (accentIdx.has(i) ? ' is-accent' : '');
            span.textContent = w;
            visual.append(span, ' ');
            return span;
        });
        el.append(sr, visual);

        let lit = 0, lastP = -1;
        if (wrap) wrap.style.setProperty('--p', '0');
        return {
            read: (s) => {
                const r = el.getBoundingClientRect();
                return clamp((s.h * .82 - r.top) / (r.height + s.h * .3));
            },
            write: (s, p) => {
                if (wrap && Math.abs(p - lastP) > .002) { wrap.style.setProperty('--p', p.toFixed(4)); lastP = p; }
                const target = Math.round(p * spans.length);
                if (target === lit) return false;
                const from = Math.min(lit, target), to = Math.max(lit, target);
                for (let i = from; i < to; i++) spans[i].classList.toggle('is-lit', target > lit);
                lit = target;
                return false;
            }
        };
    }

    /* 10.f Franja de marca: el texto avanza con el scroll, sin cortes.
           Se clonan los bloques hasta cubrir el ancho de la pantalla. */
    function marqueeModule() {
        const sec = $('#marquee');
        const track = $('#marqueeTrack');
        if (!sec || !track || reduceMotion) return null;
        let setW = 0;

        const measure = () => {
            const first = track.firstElementChild;
            if (!first) return;
            setW = first.getBoundingClientRect().width;
            while (setW > 0 && (track.children.length - 1) * setW < window.innerWidth + 8 && track.children.length < 10) {
                track.append(first.cloneNode(true));
            }
        };
        measure();
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
        window.addEventListener('resize', measure);

        return {
            read: (s) => {
                const r = sec.getBoundingClientRect();
                return (r.bottom < -40 || r.top > s.h + 40) ? null : s.y;
            },
            write: (s, y) => {
                if (y === null || !setW) return false;
                track.style.transform = 'translate3d(' + (-((y * .55) % setW)).toFixed(1) + 'px,0,0)';
                return false;
            }
        };
    }

    /* 10.g Sellos de marca: el anillo con letras gira con el scroll y el
           emblema central queda fijo */
    function sealsModule() {
        if (reduceMotion) return null;
        const items = $$('.seal').map((el) => ({
            el, ring: $('.seal-ring', el), dir: el.classList.contains('badge') ? -1 : 1
        })).filter((it) => it.ring);
        if (!items.length) return null;
        return {
            read: (s) => items.map((it) => {
                const r = it.el.getBoundingClientRect();
                return (r.bottom < -60 || r.top > s.h + 60) ? null : true;
            }),
            write: (s, vis) => {
                vis.forEach((v, i) => {
                    if (!v) return;
                    items[i].ring.style.transform = 'rotate(' + (s.y * .12 * items[i].dir).toFixed(2) + 'deg)';
                });
                return false;
            }
        };
    }

    /* 10.h Proceso: la línea se dibuja y cada paso se enciende al llegar */
    function stepsModule() {
        const box = $('#steps');
        if (!box) return null;
        const items = $$('.step', box);
        if (reduceMotion) { items.forEach((i) => i.classList.add('is-active')); box.style.setProperty('--p', '1'); return null; }
        let lastP = -1;
        return {
            read: () => {
                const r = box.getBoundingClientRect();
                return { top: r.top, height: r.height, tops: items.map((i) => i.getBoundingClientRect().top) };
            },
            write: (s, d) => {
                let p;
                if (desktop.matches) {
                    p = clamp((s.h * .86 - d.top) / (s.h * .5));
                    items.forEach((it, i) => it.classList.toggle('is-active', p >= i / items.length * .96 + .01));
                } else {
                    p = clamp((s.h * .62 - d.top) / d.height);
                    items.forEach((it, i) => it.classList.toggle('is-active', d.tops[i] < s.h * .66));
                }
                if (Math.abs(p - lastP) > .0015) { box.style.setProperty('--p', p.toFixed(4)); lastP = p; }
                return false;
            }
        };
    }

    /* 10.i Etapas de obra: en escritorio la sección queda fijada y el scroll
           avanza de etapa en etapa (cada foto se descubre con un recorte).
           En móvil son tarjetas apiladas normales. */
    function stagesModule() {
        const section = $('#etapas');
        const list = $('#stageList');
        const visual = $('#stagesVisual');
        if (!section || !list) return null;
        const items = $$('.stage', list);
        const imgs = visual ? $$('.stage-img', visual) : [];
        const n = items.length;
        let pinned = false;
        let idx = -1;
        let lastP = -1;

        const apply = () => {
            pinned = desktop.matches && !reduceMotion;
            section.classList.toggle('is-pinned', pinned);
            if (!pinned) {
                items.forEach((it) => it.classList.remove('is-active', 'is-shown'));
                imgs.forEach((im, i) => im.classList.toggle('is-shown', i === 0));
                if (visual) visual.style.removeProperty('--p');
                idx = -1; lastP = -1;
            }
        };
        apply();
        desktop.addEventListener('change', apply);

        // Clic en una etapa: el scroll viaja hasta ese punto de la sección
        items.forEach((it, i) => it.addEventListener('click', () => {
            if (!pinned) return;
            const top = section.getBoundingClientRect().top + window.scrollY;
            const total = section.offsetHeight - window.innerHeight;
            scrollToY(top + ((i + .5) / n) * total);
        }));

        return {
            read: () => (pinned ? section.getBoundingClientRect() : null),
            write: (s, rect) => {
                if (!pinned || !rect) return false;
                const total = Math.max(1, rect.height - s.h);
                const p = clamp(-rect.top / total);
                const next = clamp(Math.floor(p * n), 0, n - 1);
                if (next !== idx) {
                    idx = next;
                    items.forEach((it, i) => {
                        it.classList.toggle('is-active', i === idx);
                        it.classList.toggle('is-shown', i <= idx);
                    });
                    imgs.forEach((im, i) => {
                        im.classList.toggle('is-active', i === idx);
                        im.classList.toggle('is-shown', i <= idx);
                    });
                }
                if (visual && Math.abs(p - lastP) > .002) { visual.style.setProperty('--p', p.toFixed(4)); lastP = p; }
                return false;
            }
        };
    }

    /* ======================================================================
       11. PREGUNTAS FRECUENTES
    ====================================================================== */
    function initFaq() {
        $$('.faq-q').forEach((btn) => {
            btn.addEventListener('click', () => {
                const item = btn.closest('.faq-item');
                const open = item.classList.toggle('is-open');
                btn.setAttribute('aria-expanded', String(open));
            });
        });
    }

    /* ======================================================================
       12. GALERÍA: FILTROS Y VISOR DE FOTOS
    ====================================================================== */
    function initGallery() {
        const grid = $('#gGrid');
        const filters = $('#gFilters');
        const status = $('#gStatus');
        const lb = $('#lightbox');
        if (!grid) return;
        const items = $$('.g-item', grid);

        /* ---- Filtros ---- */
        if (filters) {
            filters.addEventListener('click', (e) => {
                const chip = e.target.closest('.g-chip');
                if (!chip) return;
                const f = chip.dataset.filter;
                $$('.g-chip', filters).forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
                let shown = 0;
                items.forEach((it) => {
                    const match = f === 'all' || it.dataset.cat === f;
                    it.hidden = !match;
                    if (!match) return;
                    shown++;
                    it.classList.add('is-in');                  // por si aún no se había revelado
                    it.classList.remove('is-pop');
                    void it.offsetWidth;
                    it.classList.add('is-pop');
                });
                if (status) status.textContent = 'Mostrando ' + shown + (shown === 1 ? ' obra' : ' obras');
            });
        }

        /* ---- Visor ---- */
        if (!lb || typeof lb.showModal !== 'function') return;
        const img = $('#lbImg');
        const cap = $('#lbCap');
        const count = $('#lbCount');
        let list = [];
        let cur = 0;
        let opener = null;

        const visible = () => $$('.g-item:not([hidden]) .g-btn', grid);

        const show = (i, instant) => {
            cur = (i + list.length) % list.length;
            const b = list[cur];
            const full = b.dataset.full;
            const alt = ($('img', b) || {}).alt || '';
            const apply = () => {
                img.src = full;
                img.alt = alt;
                cap.textContent = b.dataset.cap || '';
                count.textContent = (cur + 1) + ' / ' + list.length;
                img.classList.remove('is-swapping');
            };
            if (instant) { apply(); }
            else {
                img.classList.add('is-swapping');
                const pre = new Image();
                let done = false;
                const go = () => { if (done) return; done = true; apply(); };
                pre.onload = pre.onerror = go;
                pre.src = full;
                setTimeout(go, 600);
            }
            // Precarga de las fotos vecinas para que el cambio sea instantáneo
            [list[(cur + 1) % list.length], list[(cur - 1 + list.length) % list.length]].forEach((nb) => {
                if (nb) new Image().src = nb.dataset.full;
            });
        };

        const open = (btn) => {
            list = visible();
            opener = btn;
            lb.showModal();
            show(Math.max(0, list.indexOf(btn)), true);
            root.classList.add('lb-open');
            if (lenis) lenis.stop();
        };
        const close = () => { if (lb.open) lb.close(); };

        grid.addEventListener('click', (e) => {
            const btn = e.target.closest('.g-btn');
            if (btn) open(btn);
        });
        $('#lbClose').addEventListener('click', close);
        $('#lbPrev').addEventListener('click', () => show(cur - 1));
        $('#lbNext').addEventListener('click', () => show(cur + 1));

        lb.addEventListener('close', () => {
            root.classList.remove('lb-open');
            if (lenis) lenis.start();
            if (opener) opener.focus({ preventScroll: true });
        });
        // Clic fuera de la foto cierra el visor
        lb.addEventListener('click', (e) => {
            if (e.target === lb || e.target.classList.contains('lb-inner')) close();
        });
        lb.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight') { e.preventDefault(); show(cur + 1); }
            if (e.key === 'ArrowLeft') { e.preventDefault(); show(cur - 1); }
        });

        // Deslizar con el dedo para cambiar de foto
        let sx = 0, sy = 0, tracking = false;
        const fig = $('.lb-fig', lb);
        fig.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; tracking = true; });
        fig.addEventListener('pointerup', (e) => {
            if (!tracking) return;
            tracking = false;
            const dx = e.clientX - sx, dy = e.clientY - sy;
            if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) show(dx < 0 ? cur + 1 : cur - 1);
        });
        fig.addEventListener('pointercancel', () => { tracking = false; });
    }

    /* ======================================================================
       13. COTIZADOR GUIADO DE 3 PASOS
       Paso 1: tipo de proyecto. Paso 2: detalles. Paso 3: contacto y envío.
       Al final abre WhatsApp con el mensaje ya armado.
    ====================================================================== */
    function initQuote() {
        const form = $('#quoteForm');
        if (!form) return;
        const steps = $$('.qstep', form);
        const last = steps.length - 1;
        const stepLabel = $('#quoteStep');
        const bar = $('.quote-bar', form);
        const back = $('#qBack');
        const next = $('#qNext');
        const nextLabel = $('#qNextLabel');
        const status = $('#formStatus');
        const summary = $('#quoteSummary');

        const labelContinue = nextLabel.innerHTML;
        const labelSend = icon('whatsapp-logo-fill') + ' Enviar por WhatsApp';

        let cur = 0;
        let busy = false;

        const checked = (name) => { const r = form.querySelector('[name="' + name + '"]:checked'); return r ? r.value : ''; };
        const text = (name) => (form.elements[name].value || '').trim();

        const setError = (inputId, errId, msg) => {
            const err = $(errId);
            if (err) err.textContent = msg;
            const input = inputId ? $(inputId) : null;
            if (input) {
                input.closest('.field').classList.toggle('has-error', Boolean(msg));
                input.setAttribute('aria-invalid', msg ? 'true' : 'false');
                if (msg) input.setAttribute('aria-describedby', err.id); else input.removeAttribute('aria-describedby');
            }
        };

        const validators = [
            () => {
                const ok = Boolean(checked('tipo'));
                setError(null, '#e-tipo', ok ? '' : 'Elige una opción para continuar.');
                return ok;
            },
            () => true,
            () => {
                const nameOk = text('nombre').length >= 3;
                const telOk = text('telefono').replace(/\D/g, '').length >= 10;
                setError('#f-nombre', '#e-nombre', nameOk ? '' : 'Escribe tu nombre completo.');
                setError('#f-tel', '#e-tel', telOk ? '' : 'Escribe un número de 10 dígitos para poder contactarte.');
                return nameOk && telOk;
            }
        ];

        const renderSummary = () => {
            const rows = [
                ['Proyecto', checked('tipo')],
                ['Superficie', checked('superficie')],
                ['Inicio', checked('inicio')],
                ['Ubicación', text('ubicacion')]
            ].filter((r) => r[1]);
            summary.textContent = '';
            rows.forEach(([k, v]) => {
                const row = document.createElement('div');
                const dt = document.createElement('dt'); dt.textContent = k;
                const dd = document.createElement('dd'); dd.textContent = v;
                row.append(dt, dd);
                summary.append(row);
            });
        };

        const go = (n, focus) => {
            cur = clamp(n, 0, last);
            steps.forEach((s, i) => {
                s.hidden = i !== cur;
                s.classList.remove('is-entering');
            });
            void steps[cur].offsetWidth;
            if (!reduceMotion) steps[cur].classList.add('is-entering');
            stepLabel.textContent = 'Paso ' + (cur + 1) + ' de ' + steps.length;
            bar.style.setProperty('--q', ((cur + 1) / steps.length).toFixed(3));
            back.hidden = cur === 0;
            nextLabel.innerHTML = cur === last ? labelSend : labelContinue;
            if (cur === last) renderSummary();
            status.textContent = '';
            if (focus) { const legend = $('legend', steps[cur]); if (legend) legend.focus({ preventScroll: true }); }
        };

        // Quita el error en cuanto el usuario corrige el campo
        form.addEventListener('input', () => {
            if (!busy && ($$('.has-error', form).length || $('#e-tipo').textContent)) validators[cur]();
        });
        form.addEventListener('change', () => { if (cur === 0 && $('#e-tipo').textContent) validators[0](); });

        back.addEventListener('click', () => go(cur - 1, true));

        const buildMessage = () => {
            const lines = [
                'Hola, soy ' + text('nombre') + '. Vi su página web y quiero cotizar un proyecto.',
                '',
                '*Proyecto:* ' + checked('tipo')
            ];
            if (checked('superficie')) lines.push('*Superficie aproximada:* ' + checked('superficie'));
            if (checked('inicio')) lines.push('*Inicio deseado:* ' + checked('inicio'));
            if (text('ubicacion')) lines.push('*Ubicación:* ' + text('ubicacion'));
            if (text('mensaje')) lines.push('*Detalles:* ' + text('mensaje'));
            lines.push('*Mi WhatsApp:* ' + text('telefono'));
            return lines.join('\n');
        };

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            if (busy) return;

            if (cur < last) {
                if (!validators[cur]()) { status.textContent = cur === 0 ? '' : 'Revisa los campos marcados para continuar.'; return; }
                go(cur + 1, true);
                return;
            }

            // Último paso: se valida todo antes de enviar
            if (!validators[0]()) { go(0, true); status.textContent = 'Elige el tipo de proyecto para continuar.'; return; }
            if (!validators[2]()) {
                $(text('nombre').length < 3 ? '#f-nombre' : '#f-tel').focus();
                status.textContent = 'Revisa los campos marcados para continuar.';
                return;
            }

            busy = true;
            status.textContent = '';

            // WhatsApp se abre dentro del gesto del usuario para que el navegador no bloquee la ventana
            // (un enlace con target _blank evita que window.open con "noopener", que siempre devuelve null,
            //  termine navegando también la página actual)
            const link = document.createElement('a');
            link.href = waLink(buildMessage());
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            document.body.append(link);
            link.click();
            link.remove();

            next.classList.add('is-loading');
            next.setAttribute('aria-busy', 'true');

            setTimeout(() => {
                next.classList.remove('is-loading');
                next.removeAttribute('aria-busy');
                next.classList.add('is-success');
                nextLabel.innerHTML = icon('check-circle-fill') + ' Listo, abriendo WhatsApp';
                status.textContent = 'Si WhatsApp no se abrió, vuelve a tocar el botón.';
                busy = false;
            }, 1000);

            setTimeout(() => {
                next.classList.remove('is-success');
                form.reset();
                $$('.has-error', form).forEach((f) => f.classList.remove('has-error'));
                $$('[aria-invalid]', form).forEach((f) => f.removeAttribute('aria-invalid'));
                go(0, false);
            }, 6500);
        });

        go(0, false);
    }

    /* ======================================================================
       14. BOTÓN FLOTANTE DE WHATSAPP
    ====================================================================== */
    function initWaFloat() {
        const wa = $('#waFloat');
        if (!wa) return;
        setTimeout(() => wa.classList.add('is-visible'), 1200);

        let seen = false;
        try { seen = sessionStorage.getItem('waTip') === '1'; } catch (e) { /* sin storage */ }
        if (seen) return;
        setTimeout(() => {
            wa.classList.add('show-tip');
            try { sessionStorage.setItem('waTip', '1'); } catch (e) { /* sin storage */ }
            setTimeout(() => wa.classList.remove('show-tip'), 5200);
        }, 7000);
    }

    /* ======================================================================
       15. ARRANQUE
    ====================================================================== */
    function init() {
        safe(initSmoothScroll, 'smoothScroll');
        safe(initContactLinks, 'contactLinks');
        safe(initSplit, 'split');                       // antes del revelado: crea las palabras
        safe(initImages, 'images');
        safe(initAnchors, 'anchors');
        safe(initHeader, 'header');
        safe(initNavPill, 'navPill');
        safe(initMenu, 'menu');
        safe(initActiveNav, 'activeNav');
        safe(initServices, 'services');
        safe(initFaq, 'faq');
        safe(initGallery, 'gallery');
        safe(initQuote, 'quote');
        safe(initReveal, 'reveal');
        safe(initCounters, 'counters');

        const modules = [
            safe(progressModule, 'progress'),
            safe(headerModule, 'headerScroll'),
            safe(heroModule, 'heroScroll'),
            safe(parallaxModule, 'parallax'),
            safe(manifestoModule, 'manifesto'),
            safe(marqueeModule, 'marquee'),
            safe(sealsModule, 'seals'),
            safe(stepsModule, 'steps'),
            safe(stagesModule, 'stages')
        ].filter(Boolean);
        createLoop(modules);

        initLoader().then(() => {
            // El telón del loader empieza a subir; el hero entra mientras se abre
            setTimeout(() => {
                safe(playHeroIntro, 'heroIntro');
                safe(initRotator, 'rotator');
            }, reduceMotion ? 0 : 750);
            safe(initWaFloat, 'waFloat');

            if (location.hash) {
                const target = document.getElementById(location.hash.slice(1));
                if (target) setTimeout(() => scrollToTarget(target, true), 80);
            }
        });
    }

    init();
})();
