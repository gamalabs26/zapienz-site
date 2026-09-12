/* =========================================================================
   ZAPIENZ — motor de movimiento. Vanilla, sin framework, sin GSAP.
   Cada mecanica va en UN bloque contiguo: el gate exige que las huellas de
   una tecnica caigan juntas en el mismo archivo.
   Reglas de la casa: solo transform y opacity; ease-out nunca ease-in;
   UI < 300ms; nada arranca desde scale(0); un solo seek a la vez.
   ========================================================================= */
(() => {
'use strict';

const suave = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finoPuntero = window.matchMedia('(hover:hover) and (pointer:fine)').matches;
const esMovil = window.matchMedia('(max-width: 767px)').matches;
const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* ---------- ciclo de vida de rAF ----------------------------------------
   Un loop solo corre si su elemento esta en pantalla Y la pagina esta viva.
   pageshow/pagehide ademas de visibilitychange: el bfcache de Safari
   restaura la pagina sin recargarla y los loops se quedaban muertos. */
const loops = new Set();
function loop(el, tick){
  const reg = { tick, activo: false, raf: 0 };
  const correr = () => {
    if (!reg.activo || document.hidden) { reg.raf = 0; return; }
    reg.tick();
    reg.raf = requestAnimationFrame(correr);
  };
  reg.arrancar = () => { if (!reg.raf && reg.activo && !document.hidden) reg.raf = requestAnimationFrame(correr); };
  new IntersectionObserver(es => {
    reg.activo = es[0].isIntersecting;
    if (reg.activo) reg.arrancar();
  }, { rootMargin: '120px' }).observe(el);
  loops.add(reg);
  return reg;
}
const despertar = () => loops.forEach(r => r.arrancar());
document.addEventListener('visibilitychange', despertar);
window.addEventListener('pageshow', despertar);
window.addEventListener('pagehide', () => loops.forEach(r => { cancelAnimationFrame(r.raf); r.raf = 0; }));

/* ---------- piso gratis: reveals + stagger ------------------------------- */
{
  const io = new IntersectionObserver((es, o) => {
    es.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target;
      const i = +(el.dataset.stagger || 0);
      setTimeout(() => el.classList.add('visible'), clamp(i * 60, 0, 400));
      o.unobserve(el);
    });
  }, { rootMargin: '-10% 0px -10% 0px' });
  const registrar = () => $$('.rev, .subrayado, .palabra').forEach(el => {
    // Barrido inicial: un renderer con rAF estrangulado puede no disparar el IO
    // en el primer paint, y la seccion se quedaria invisible para siempre.
    if (el.getBoundingClientRect().top < innerHeight * 0.9) el.classList.add('visible');
    else io.observe(el);
  });
  addEventListener('DOMContentLoaded', registrar);
  if (document.readyState !== 'loading') registrar();
}

/* ---------- blur-in-word: parte el titular en palabras -------------------
   filter: blur por palabra, con stagger. La transicion vive en el CSS. */
{
  $$('[data-blur-words]').forEach(h => {
    const partes = h.textContent.trim().split(/\s+/);
    h.textContent = '';
    partes.forEach((palabra, i) => {
      const s = document.createElement('span');
      s.className = 'palabra';
      s.style.transitionDelay = (i * 70) + 'ms';
      s.textContent = palabra;
      h.append(s, document.createTextNode(' '));
    });
  });
}

/* ---------- NAV ---------------------------------------------------------- */
/* La pildora se ESCONDE al bajar y vuelve al subir. En un iPhone de 844 px de
   alto, 64 px de nav mas sus 14 px de margen son el 9% de la pantalla comidos
   todo el rato: medido en capturas de 390x844, el nav tapaba la cifra de una
   tarjeta de estante, el nombre de otra categoria entera y una pregunta del
   acordeon. Al bajar nadie necesita el menu; al subir, si. El umbral de 6 px
   evita que el rebote del scroll la haga parpadear. */
{
  const nav = $('.nav');
  if (nav){
    let ultimo = scrollY, acumulado = 0;
    addEventListener('scroll', () => {
      const y = scrollY;
      const paso = y - ultimo;
      nav.dataset.encogido = y > 80 ? 'si' : 'no';

      if (Math.sign(paso) !== Math.sign(acumulado)) acumulado = 0;
      acumulado += paso;

      if (y < 120){ nav.dataset.oculto = 'no'; }
      else if (acumulado > 6)  nav.dataset.oculto = 'si';
      else if (acumulado < -6) nav.dataset.oculto = 'no';
      ultimo = y;
    }, { passive: true });

    /* Con teclado la pildora tiene que reaparecer: si el foco entra en un enlace
       escondido, nadie ve donde esta parado. */
    nav.addEventListener('focusin', () => { nav.dataset.oculto = 'no'; });
  }
}

/* =========================================================================
   MECANICA — curtain-palette-swap
   Cortina verde de 100vw que barre en diagonal y conmuta data-tema en <html>.
   Siete cruces en el recorrido; la paleta entera cambia por variables CSS.
   ========================================================================= */
{
  const cortina = $('.cortina');
  const raiz = document.documentElement;
  let cruzando = false;

  function correrCortina(temaNuevo){
    if (!cortina || cruzando || raiz.dataset.tema === temaNuevo) return;
    if (!suave) { raiz.dataset.tema = temaNuevo; return; }
    cruzando = true;
    cortina.style.setProperty('--cortina-destino',
      temaNuevo === 'papel' ? 'var(--papel)' : 'var(--noche)');
    const D = 520;                                    // --dur-curtain
    const E = 'cubic-bezier(.22,1,.36,1)';            // --ease-drawer
    cortina.style.transition = 'none';
    cortina.style.transform = 'translate3d(-101%,0,0) skewX(-8deg)';
    requestAnimationFrame(() => {
      cortina.style.transition = `transform ${D}ms ${E}`;
      cortina.style.transform = 'translate3d(0,0,0) skewX(-8deg)';
      setTimeout(() => {
        raiz.dataset.tema = temaNuevo;
        raiz.style.setProperty('--tema-actual', temaNuevo);
        cortina.style.transform = 'translate3d(101%,0,0) skewX(-8deg)';
        setTimeout(() => { cruzando = false; }, D);
      }, D);
    });
  }

  /* La cortina cruza UNA vez en todo el recorrido, en la seccion marcada con
     `data-cortina`. Cruzaba en las seis alternancias de superficie, y seis
     barridos a pantalla completa no se leen como capitulos: se leen como las
     transiciones de una presentacion. Un corte de capitulo que ocurre siempre
     deja de ser un corte de capitulo. Las demas secciones siguen cambiando de
     paleta -- cada una pinta su superficie con `data-superficie` -- solo que sin
     nada encima tapando la pantalla. */
  const io = new IntersectionObserver(es => {
    es.forEach(e => {
      if (!e.isIntersecting || e.intersectionRatio <= 0.5) return;
      const destino = e.target.dataset.superficie || 'noche';
      if (e.target.dataset.cortina === 'si') correrCortina(destino);
      else { raiz.dataset.tema = destino; raiz.style.setProperty('--tema-actual', destino); }
    });
  }, { threshold: [0.5] });
  $$('[data-superficie]').forEach(s => io.observe(s));
}

/* =========================================================================
   MECANICA — parallax-layers
   Tres profundidades movidas por transform en rAF. Nunca top/margin.
   El muro vive en la seccion de precios, asi que la referencia NO puede ser
   `scrollY` absoluto: a 8,000 px de scroll una profundidad de .24 desplazaria la
   capa 1,900 px y el muro se saldria de su seccion. Se mide contra el centro de
   la propia seccion, que vale 0 cuando esta centrada en pantalla.
   ========================================================================= */
{
  const capas = $$('.muro__capa[data-depth]');
  const zona = $('.seccion--muro');
  if (zona && capas.length && suave){
    loop(zona, () => {
      const r = zona.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) return;
      // Cuanto falta para que el centro de la seccion cruce el centro de la
      // pantalla, en pixeles: negativo antes, positivo despues.
      const desfase = (r.top + r.height / 2) - innerHeight / 2;
      capas.forEach(c => {
        const profundidad = parseFloat(c.dataset.depth) || 0;
        c.style.transform = `translate3d(0, ${(-desfase * profundidad).toFixed(2)}px, 0)`;
      });
    });
  }
}

/* =========================================================================
   MECANICA — canvas-frame-scrub  (PROTAGONISTA del hero)
   Los cuadros del clip se dibujan en canvas y los mueve el SCROLL, no el
   tiempo. Ventana rodante de 12 cuadros para no cargar los 90 de golpe, y
   un solo seek a la vez.
   Si no hay manifiesto (el video aun no se produce), el poster se queda y la
   pagina funciona: el hueco se marca, no se disfraza con arte geometrico.
   ========================================================================= */
{
  const caja = $('.hero__lienzo');
  const cv = caja && caja.querySelector('canvas');
  const hero = $('.hero');
  const vid = $('.hero__video');
  const KEEP = 12;

  // El clip en reposo. Se descubre cuando de verdad tiene un cuadro que ensenar,
  // no antes: asi el cambio poster -> video no parpadea. Con movimiento reducido
  // se queda congelado en su primer cuadro, que es el mismo poster.
  if (vid){
    const listo = () => { vid.dataset.listo = 'si'; };
    if (vid.readyState >= 2) listo(); else vid.addEventListener('loadeddata', listo, { once:true });
    if (!suave){ vid.autoplay = false; vid.removeAttribute('autoplay'); vid.pause(); }
    else {
      // Safari/iOS rechaza el autoplay si el gesto llega antes que los metadatos.
      const arranca = () => { const p = vid.play(); if (p && p.catch) p.catch(() => {}); };
      arranca();
      vid.addEventListener('canplay', arranca, { once:true });
    }
  }

  // Un solo interruptor para los dos: mientras `scrub` esta apagado manda el video;
  // en cuanto el hero empieza a salir de cuadro manda el canvas y el video se pausa
  // para no gastar decodificador en algo que ya nadie ve.
  let scrub = false;
  function modo(activo){
    if (activo === scrub) return;
    scrub = activo;
    hero.dataset.scrub = activo ? 'si' : 'no';
    if (!vid || !suave) return;
    if (activo) vid.pause();
    else { const p = vid.play(); if (p && p.catch) p.catch(() => {}); }
  }

  if (cv && hero){
    const ctx = cv.getContext('2d', { alpha: false });
    const carpeta = esMovil ? 'mobile' : 'desktop';
    const frames = [];               // ventana rodante de HTMLImageElement
    let manifiesto = null, pedido = -1, cargando = false, ultimo = -1;

    const dimensionar = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      cv.width  = Math.round(caja.clientWidth  * dpr);
      cv.height = Math.round(caja.clientHeight * dpr);
    };

    function pintar(i){
      const img = frames[i];
      if (!img || !img.complete || !img.naturalWidth) return;
      const e = Math.max(cv.width / img.naturalWidth, cv.height / img.naturalHeight);
      const w = img.naturalWidth * e, h = img.naturalHeight * e;
      ctx.drawImage(img, (cv.width - w) / 2, (cv.height - h) / 2, w, h);
      caja.dataset.pintado = 'si';
      ultimo = i;
    }

    // Un solo seek a la vez: si llega otro mientras carga, se guarda y se
    // atiende al terminar. Sin esta puerta el scroll rapido encola decenas.
    function pedir(i){
      if (!manifiesto) return;
      if (frames[i]) { pintar(i); return; }
      pedido = i;
      if (cargando) return;
      cargando = true;
      const n = pedido;
      const img = new Image();
      img.decoding = 'async';
      img.src = `assets/frames/${carpeta}/${manifiesto.patron.replace('%d', String(n).padStart(4, '0'))}`;
      img.onload = img.onerror = () => {
        frames[n] = img;
        const vivos = Object.keys(frames);
        if (vivos.length > KEEP) vivos.slice(0, vivos.length - KEEP)
          .forEach(k => { if (Math.abs(k - n) > KEEP) delete frames[k]; });
        cargando = false;
        pintar(n);
        if (pedido !== n) pedir(pedido);
      };
    }

    fetch('assets/frames/manifest.json')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(m => {
        manifiesto = m;
        dimensionar();
        pedir(0);
        addEventListener('resize', () => { dimensionar(); if (ultimo >= 0) pintar(ultimo); });
        loop(hero, () => {
          const r = hero.getBoundingClientRect();
          const avance = clamp(-r.top / Math.max(1, r.height), 0, 1);
          // 0.015 y no 0: sin margen, el rebote del scroll en iOS enciende y apaga
          // el cambio decenas de veces mientras el hero esta quieto.
          modo(avance > 0.015);
          const i = Math.round(avance * (m.total - 1));
          if (i !== ultimo) pedir(i);
        });
      })
      .catch(() => {
        // Hueco declarado: sin clip producido, el hero se queda en su poster.
        caja.dataset.sinFrames = 'si';
        console.info('[zapienz] hero sin frames: falta producir el clip. Poster activo.');
      });
  }
}

/* =========================================================================
   MECANICA — pinned-saga  (PROTAGONISTA de §3)
   Un Zap real abierto en la app muta por sus 6 secciones reales al ritmo del
   scroll dentro de un pin: cambia el rotulo de la pantalla, avanza el
   «Seccion N de 6» del mini-reproductor y crece la barra de progreso. El pin
   lo pone este script: sin JS la saga queda como lista apilada.
   ========================================================================= */
{
  const saga  = $('.saga');
  const pin   = $('.saga__pin');
  const items = $$('.saga__lista li');
  const fono   = $('.fono__pantalla');
  const rotulo = $('[data-fono-titulo]');
  const paso   = $('[data-fono-paso]');
  const barra  = $('[data-fono-barra]');

  if (saga && pin && items.length && suave){
    pin.style.cssText += 'position: sticky;';   // el pin es mejora progresiva, no base
    // Los 6 capitulos son las secciones LITERALES del Zap en la base de datos, y el
    // rotulo del telefono se LEE de la lista: un solo lugar donde viven los titulos.
    const capitulos = items.map((li, i) => ({ i, li, titulo: li.textContent.trim() }));
    let activo = -1;

    loop(saga, () => {
      const r = saga.getBoundingClientRect();
      const total = Math.max(1, r.height - innerHeight);
      const avance = clamp(-r.top / total, 0, 1);
      const n = clamp(Math.floor(avance * capitulos.length), 0, capitulos.length - 1);
      const giro = (avance - 0.5) * 9;
      const desliz = (avance * -16).toFixed(2);
      if (fono) fono.style.transform =
        `translate3d(0, ${desliz}px, 0) rotateY(${giro.toFixed(2)}deg)`;
      // Arranca en 8% y no en 0: un reproductor con la barra en cero se lee como
      // «no ha empezado», y aqui el Zap ya esta sonando.
      if (barra) barra.style.transform = 'scaleX(' + ((8 + avance * 92) / 100).toFixed(4) + ')';
      if (n !== activo){
        activo = n;
        capitulos.forEach(c => { c.li.dataset.activo = c.i === n ? 'si' : 'no'; });
        if (rotulo) rotulo.textContent = capitulos[n].titulo;
        if (paso) paso.textContent = 'Sección ' + (n + 1) + ' de ' + capitulos.length;
      }
    });
  } else if (items.length){
    items.forEach(li => { li.dataset.activo = 'si'; });
  }
}

/* =========================================================================
   La onda DENTRO del telefono. Es la misma firma de marca del hero y del
   catalogo, a escala de pantalla de movil: sin ella el reproductor se ve
   apagado y la seccion vuelve a ser una tarjeta con texto.
   ========================================================================= */
{
  const cv = $('.fono__onda');
  if (cv && cv.getContext){
    const ctx = cv.getContext('2d');
    const PASO = 6, ANCHO = 3;
    let dpr = 1, barras = 0;

    const medir = () => {
      dpr = Math.min(devicePixelRatio || 1, 2);
      const r = cv.getBoundingClientRect();
      if (!r.width || !r.height) return;
      cv.width  = Math.round(r.width  * dpr);
      cv.height = Math.round(r.height * dpr);
      barras = Math.ceil(cv.width / (PASO * dpr));
    };
    medir();
    if (window.ResizeObserver) new ResizeObserver(medir).observe(cv);

    const t0 = performance.now();
    function pintar(){
      if (!cv.width || !barras) return;
      const t = (performance.now() - t0) / 1000;
      const h = cv.height, w = ANCHO * dpr, p = PASO * dpr;
      ctx.clearRect(0, 0, cv.width, h);
      for (let i = 0; i < barras; i++){
        const v = 0.34
                + 0.28 * Math.sin(i * 0.33 - t * 2.1)
                + 0.14 * Math.sin(i * 0.087 + t * 0.9);
        const alto = Math.max(2 * dpr, Math.min(1, v) * h * 0.86);
        // La mitad izquierda es lo ya escuchado (verde lleno); la derecha, lo que
        // falta (verde apagado). Es como se lee una onda en un reproductor.
        const oido = i / barras < 0.42;
        ctx.fillStyle = oido ? '#38EB6B' : 'rgba(74,180,114,.34)';
        const x = i * p, y = (h - alto) / 2;
        if (ctx.roundRect){ ctx.beginPath(); ctx.roundRect(x, y, w, alto, w / 2); ctx.fill(); }
        else ctx.fillRect(x, y, w, alto);
      }
    }
    if (suave) loop(cv, pintar); else requestAnimationFrame(() => { medir(); pintar(); });
  }
}

/* =========================================================================
   MECANICA — pipeline-beam
   Un haz recorre el path SVG que une las 6 secciones de un Zap. El degradado
   se construye aqui para que viaje con el codigo que lo anima.
   ========================================================================= */
{
  const svg = $('.saga__haz');
  if (svg && suave){
    const NS = 'http://www.w3.org/2000/svg';
    const defs = document.createElementNS(NS, 'defs');
    const grad = document.createElementNS(NS, 'linearGradient');
    grad.setAttribute('id', 'hazZap');
    grad.setAttribute('x1', '0'); grad.setAttribute('y1', '0');
    grad.setAttribute('x2', '0'); grad.setAttribute('y2', '1');
    [['0%', 0], ['50%', 1], ['100%', 0]].forEach(([off, op]) => {
      const s = document.createElementNS(NS, 'stop');
      s.setAttribute('offset', off);
      s.setAttribute('stop-color', '#38EB6B');
      s.setAttribute('stop-opacity', op);
      grad.appendChild(s);
    });
    defs.appendChild(grad);
    const linea = document.createElementNS(NS, 'rect');
    linea.setAttribute('x', '0'); linea.setAttribute('width', '2');
    linea.setAttribute('height', '30%');
    linea.setAttribute('fill', 'url(#hazZap)');
    svg.append(defs, linea);
    loop(svg, () => {
      const r = svg.getBoundingClientRect();
      const avance = clamp((innerHeight * 0.5 - r.top) / Math.max(1, r.height), 0, 1);
      linea.setAttribute('y', (avance * 70).toFixed(2) + '%');
    });
  }
}

/* =========================================================================
   MECANICA — spotlight-reveal  (PROTAGONISTA de §4)
   El haz descubre, bajo el parrafo, la onda de ese mismo audio. La mascara y
   el radial-gradient viven en el CSS; aqui solo se mueven --mx y --my.
   Pointer Events, no mousemove: el mismo codigo sirve al dedo y al raton.
   ========================================================================= */
{
  const foco = $('.linterna');
  if (foco){
    const pista = $('.linterna__pista', foco);
    const mover = e => {
      const r = foco.getBoundingClientRect();
      foco.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100).toFixed(2) + '%');
      foco.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100).toFixed(2) + '%');
      if (pista) pista.style.opacity = '0';
    };
    foco.addEventListener('pointerdown', e => { foco.setPointerCapture(e.pointerId); mover(e); });
    foco.addEventListener('pointermove', mover);
    /* Al salir se BORRAN las variables, no se ponen al centro. Ponerlas al 50/50
       devolvia el haz justo encima de la cita y tapaba renglones enteros, que es
       lo que el CSS ya habia corregido con su reposo abajo a la derecha: el JS lo
       estaba deshaciendo en cuanto el cursor abandonaba la tarjeta. */
    foco.addEventListener('pointerleave', () => {
      foco.style.removeProperty('--mx');
      foco.style.removeProperty('--my');
      if (pista) pista.style.opacity = '';
    });
    // La pista dice lo que el aparato de verdad hace.
    if (pista) pista.textContent = finoPuntero ? 'mueve el cursor' : 'desliza el dedo';
  }
}

/* =========================================================================
   MECANICA — scramble
   Las cifras y los precios se descifran al entrar. Nunca en texto largo.
   ========================================================================= */
{
  const CHARS = '0123456789$.,';
  const randomChar = () => CHARS[(Math.random() * CHARS.length) | 0];
  function scramble(el){
    const final = el.dataset.valor || el.textContent;
    const pasos = 14;
    let n = 0;
    const id = setInterval(() => {
      n++;
      el.textContent = final.split('').map((c, i) =>
        (i < final.length * (n / pasos) || c === ' ') ? c : randomChar()).join('');
      if (n >= pasos){ clearInterval(id); el.textContent = final; }
    }, 28);
  }
  const io = new IntersectionObserver((es, o) => es.forEach(e => {
    if (!e.isIntersecting) return;
    if (suave) scramble(e.target);
    o.unobserve(e.target);
  }), { rootMargin: '-10% 0px' });
  $$('[data-scramble]').forEach(el => { el.dataset.valor = el.textContent; io.observe(el); });
}

/* =========================================================================
   MECANICA — highlighter-sweep
   El marcatextos subraya la frase clave al entrar. Es el gesto de LEER, y por
   eso solo se usa dos veces en todo el sitio.
   ========================================================================= */
{
  const io = new IntersectionObserver((es, o) => es.forEach(e => {
    if (!e.isIntersecting) return;
    const subray = e.target;
    subray.classList.add('visible');
    const trazo = getComputedStyle(subray, '::after');
    if (trazo && suave) subray.style.setProperty('--trazo', 'scaleX(1)');
    o.unobserve(subray);
  }), { rootMargin: '-15% 0px' });
  $$('.subrayado').forEach(el => io.observe(el));
}

/* =========================================================================
   MECANICA — char-reveal-scroll
   El manifiesto se enciende letra por letra segun la POSICION de scroll, no
   con un disparador de entrada: el lector controla el ritmo.
   ========================================================================= */
{
  const bloque = $('[data-char-reveal]');
  if (bloque && suave){
    const letras = bloque.textContent.trim().split('').map(c => {
      const s = document.createElement('span');
      s.textContent = c;
      s.style.opacity = '0.14';
      return s;
    });
    bloque.textContent = '';
    letras.forEach(s => bloque.appendChild(s));
    loop(bloque, () => {
      const r = bloque.getBoundingClientRect();
      const avance = clamp((innerHeight * 0.82 - r.top) / (r.height + innerHeight * 0.28), 0, 1);
      const hasta = avance * letras.length;
      for (let i = 0; i < letras.length; i++){
        const v = clamp((hasta - i) / 8, 0.14, 1);
        letras[i].style.opacity = v.toFixed(3);
      }
    });
  }
}

/* =========================================================================
   MECANICA — catalog-waveform  (PROTAGONISTA de §5)
   289 barras en telefono y en escritorio: una por Zap con audio publicado, que es lo
   que dice la linea de arriba. Altura = minutos, normalizados del rango
   REAL 14-24 al rango visual 14%-86%. Mapear linealmente al alto daria un
   ecualizador casi plano, porque el dato es angosto. Color = categoria.
   Bajo el puntero (o el dedo) la barra mas cercana se levanta y se identifica.
   ========================================================================= */
{
  const caja = $('.estante__lienzo');
  const cv = caja && caja.querySelector('canvas');
  const tip = caja && $('.estante__tooltip', caja);
  const crudo = $('#catalogo');

  if (cv && crudo){
    const catalogo = JSON.parse(crudo.textContent);
    const ctx = cv.getContext('2d');
    const MIN = 14, MAX = 24;                       // rango GLOBAL, solo para normalizar el alto
    const cats = [...new Set(catalogo.map(z => z.categoria))];
    /* El rango de CADA estante, calculado del mismo dato que dibuja las barras.
       Antes el rotulo del movil imprimia MIN-MAX, o sea 14-24, para los diez
       estantes -- y ninguno de los diez tiene ese rango: Relaciones va de 19 a 23
       y Biografias de 14 a 22. Era una cifra inventada, y encima se contradecia
       con la pagina del estante, que si publica el rango real. */
    const porEstante = {};
    cats.forEach(c => {
      const g = catalogo.filter(z => z.categoria === c).map(z => z.minutos);
      porEstante[c] = { n: g.length, min: Math.min(...g), max: Math.max(...g) };
    });
    const mezcla = (t) => {
      const a = [0x4A, 0xB4, 0x72], b = [0x38, 0xEB, 0x6B];   // --verde -> --verde-brillo
      return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
    };

    // Agrupadas por categoria y, dentro, por duracion. Hueco entre grupos.
    const orden = [...catalogo].sort((x, y) =>
      cats.indexOf(x.categoria) - cats.indexOf(y.categoria) || x.minutos - y.minutos);

    let barras = [], px = 0, py = 0, dentro = false, t0 = performance.now();

    function medir(){
      const dpr = Math.min(devicePixelRatio || 1, 2);
      // Se mide el LIENZO, no su caja: desde que la placa noche lleva relleno,
      // `caja.clientWidth` incluye esos 22 px por lado y el mapa de bits salia
      // mas ancho que el elemento, que comprime el dibujo entero.
      cv.width = Math.round(cv.clientWidth * dpr);
      cv.height = Math.round(cv.clientHeight * dpr);
      /* En telefono dibujaba TRES barras por estante -- 30 en total -- debajo de una
         linea que dice que cada barra es un Zap publicado. Era falso justo en el
         aparato del que viene el trafico de una app de iPhone. Ahora son las 289
         en los dos tamanos; lo que se encoge es el hueco entre estantes, de tres
         anchos de barra a uno, para que a 390 px la silueta siga leyendose. */
      const salto = esMovil ? 1 : 3;
      const huecos = cats.length - 1;
      const ancho = cv.width / (orden.length + huecos * salto);
      barras = orden.map((z, i) => {
        const saltos = cats.indexOf(z.categoria) * salto;
        const norm = (clamp(z.minutos, MIN, MAX) - MIN) / (MAX - MIN);
        return {
          z, x: (i + saltos) * ancho, w: ancho * 0.72,
          // Techo 0.86 y no 0.92: con el rango real de 14-24 min la mayoria de las
          // barras cae arriba y varias tocaban el borde de la placa, que borra la
          // silueta. Medido en captura sobre las 289.
          alto: (0.14 + norm * 0.72) * cv.height,
          fase: Math.random() * 6.28, vel: 2.8 + Math.random() * 1.4, sube: 0
        };
      });
    }

    function dibujar(){
      const t = (performance.now() - t0) / 1000;
      ctx.clearRect(0, 0, cv.width, cv.height);
      const radio = Math.min(60 * (devicePixelRatio || 1), cv.width * 0.12);
      barras.forEach(b => {
        const cerca = dentro ? clamp(1 - Math.abs(b.x + b.w / 2 - px) / radio, 0, 1) : 0;
        b.sube += (cerca - b.sube) * 0.12;                       // lerp
        const respira = 1 + Math.sin(t * (6.28 / b.vel) + b.fase) * 0.06;
        const h = b.alto * respira * (1 + b.sube * 0.30);
        const y = cv.height - h;
        ctx.fillStyle = mezcla(cats.indexOf(b.z.categoria) / Math.max(1, cats.length - 1));
        ctx.globalAlpha = 0.78 + b.sube * 0.22;
        if (ctx.roundRect){
          ctx.beginPath();
          ctx.roundRect(b.x, y, b.w, h, b.w / 2);
          ctx.fill();
        } else {
          ctx.fillRect(b.x, y, b.w, h);
        }
      });
      ctx.globalAlpha = 1;
    }

    const puntero = e => {
      const r = cv.getBoundingClientRect();
      const dpr = cv.width / r.width;
      px = (e.clientX - r.left) * dpr;
      py = (e.clientY - r.top) * dpr;
      // El rotulo es hijo de la PLACA, no del lienzo: sus coordenadas se miden
      // contra la placa o queda corrido los 22 px del relleno.
      const rc = caja.getBoundingClientRect();
      dentro = true;
      const b = barras.reduce((mej, c) =>
        Math.abs(c.x - px) < Math.abs(mej.x - px) ? c : mej, barras[0]);
      if (b && tip){
        const r0 = porEstante[b.z.categoria];
        tip.textContent = esMovil
          ? `${b.z.categoria} · ${r0.n} libros · ${r0.min}-${r0.max} min`
          : `${b.z.titulo} · ${b.z.autor} · ${b.z.minutos} min · ${b.z.categoria}`;
        tip.dataset.ver = 'si';
        /* El ancho se MIDE. Estaba clavado en 190 px y un rotulo como
           Finanzas 26 libros 18-24 min mide mas, asi que en telefono se salia de
           la placa y se leia cortado a media cifra. Se mide solo al cambiar. */
        if (tip.dataset.txt !== tip.textContent){
          tip.dataset.txt = tip.textContent;
          tip.dataset.w = tip.offsetWidth || 190;
        }
        const w = +tip.dataset.w;
        tip.style.transform =
          `translate3d(${clamp(e.clientX - rc.left - w / 2, 4, Math.max(4, rc.width - w - 4))}px, ${clamp(e.clientY - rc.top - 52, 4, rc.height - 10)}px, 0)`;
      }
    };
    cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); puntero(e); });
    cv.addEventListener('pointermove', puntero);
    cv.addEventListener('pointerleave', () => {
      dentro = false; if (tip) tip.dataset.ver = 'no';
    });
    cv.addEventListener('click', () => { location.href = $('.cta').href; });

    medir();
    // Al cambiar de tamano se remide y se repinta en el cuadro siguiente, no en
    // medio del reflow: dibujar dentro del propio evento provoca un salto visible.
    addEventListener('resize', () => { medir(); requestAnimationFrame(dibujar); });
    if (suave) loop(caja, dibujar);
    else { barras.forEach(b => b.sube = 0); requestAnimationFrame(dibujar); }
  }
}

/* =========================================================================
   MECANICA — video-loop-seamless
   Ping-pong real: al llegar al final el clip vuelve invirtiendo la direccion,
   sin el salto de un <video loop> pelado. El MP4 ya viene rebobinado con
   ffmpeg; este guardia cubre el caso de que falte esa pasada.
   ========================================================================= */
{
  $$('video[data-pingpong]').forEach(v => {
    v.playbackRate = 1;
    let atras = false;
    v.addEventListener('ended', () => { v.currentTime = 0; v.play().catch(() => {}); });
    v.addEventListener('timeupdate', () => {
      if (!v.duration) return;
      if (!atras && v.currentTime > v.duration - 0.06){
        atras = true;
        v.pause();
        const t0 = performance.now(), desde = v.currentTime;
        const volver = () => {
          const t = (performance.now() - t0) / 1000;
          v.currentTime = Math.max(0, desde - t);
          if (v.currentTime > 0.05) requestAnimationFrame(volver);
          else { atras = false; v.play().catch(() => {}); }
        };
        requestAnimationFrame(volver);
      }
    });
    v.play().catch(() => {});
  });
}

/* =========================================================================
   MECANICA — magnetic
   El CTA se inclina hacia el cursor. Solo con puntero fino: en tactil no hay
   nada que imantar, y ahi el boton se queda quieto con su press de 0.97.
   ========================================================================= */
{
  if (finoPuntero && suave){
    $$('[data-magnetic]').forEach(btn => {
      const imantado = 0.28;
      btn.addEventListener('pointermove', e => {
        const r = btn.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) * imantado;
        const dy = (e.clientY - (r.top + r.height / 2)) * imantado;
        btn.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0)`;
      });
      /* El boton sigue al cursor SIN transicion (el CSS se la quito) y solo la recupera al
     soltar, marcandolo con data-imantando. Antes perseguia al cursor con 200 ms de
     retraso, que es lo que lo hacia sentir pegajoso en vez de magnetico. */
    btn.addEventListener('pointerenter', () => { btn.dataset.imantando = 'si'; });
    btn.addEventListener('pointerleave', () => {
      btn.dataset.imantando = 'no';
      btn.style.transform = '';
    });
    });
  }
}

/* ---------- :active en tactil -------------------------------------------
   Safari de iOS no aplica :active a un elemento que no sea interactivo salvo que
   la pagina escuche algun evento tactil. Con este oyente vacio, el toque sobre una
   portada del bento le devuelve su color, que es el equivalente tactil del hover.
   No hace nada mas: es la forma conocida de habilitar :active, no un manejador. */
if (!finoPuntero) document.body.addEventListener('touchstart', () => {}, { passive: true });

/* =========================================================================
   MUESTRA DE AUDIO — AnalyserNode
   El CTA secundario del hero suena de verdad y la onda que se ve es el
   espectro del archivo que esta sonando, no un bucle decorativo: por eso el
   audio pasa por el grafo (fuente -> analizador -> salida) y no directo.
   Reglas de la casa que aplican aqui:
   - El AudioContext se crea DENTRO del clic. Creado al cargar nace suspendido
     en Safari y Chrome, y ademas cuesta CPU en una pagina que quiza nunca
     reproduzca nada.
   - `createMediaElementSource` DESVIA el audio del elemento hacia el grafo: si
     el analizador no se conecta a `destination`, el sitio se queda mudo.
   - El rAF vive con el play/pause, no con el viewport: si el oyente hace
     scroll el audio sigue, y lo que se detiene es solo el dibujo.
   ========================================================================= */
{
  const btn   = $('#btn-muestra');
  const au    = $('#au-muestra');
  const panel = $('#muestra');
  const cv    = panel && $('.muestra__onda', panel);
  const reloj = panel && $('.muestra__t', panel);
  const pie   = panel && $('.muestra__pie', panel);
  const rotulo = btn && $('.cta--audio__texto', btn);

  if (btn && au && panel && cv && cv.getContext){
    const ctx2d = cv.getContext('2d');
    const BARRAS = 30;
    // El rotulo de reposo vive en UNA constante y se lee del propio HTML: asi el
    // copy tiene un solo dueno (el marcado) y volver al estado inicial no puede
    // quedar desincronizado en ninguna de las tres salidas que lo restauran.
    const ROTULO = rotulo ? rotulo.textContent.trim() : 'Escucha cómo suena Zapienz';
    // El reposo NO es un espectro fingido: es un patron fijo y bajo, que se
    // distingue a simple vista de la onda viva.
    const REPOSO = i => 0.14 + 0.16 * Math.abs(Math.sin(i * 0.7));
    let audioCtx = null, analizador = null, datos = null, raf = 0, hayGrafo = false;

    const medir = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const r = cv.getBoundingClientRect();
      cv.width  = Math.max(1, Math.round(r.width  * dpr));
      cv.height = Math.max(1, Math.round(r.height * dpr));
    };
    medir();
    if (window.ResizeObserver) new ResizeObserver(() => { medir(); dibujar(); }).observe(cv);

    const mmss = s => {
      if (!isFinite(s)) return '0:00';
      const m = Math.floor(s / 60), g = Math.floor(s % 60);
      return m + ':' + String(g).padStart(2, '0');
    };

    function dibujar(){
      const w = cv.width, h = cv.height;
      // El hueco se saca del PASO, no al reves. Restando un hueco fijo del ancho
      // total, un lienzo angosto daba barras de ancho NEGATIVO y `roundRect`
      // reventaba con «Radius value -0.466667 is negative» -- justo lo que pasaba
      // en el primer cuadro, con el panel todavia en display:none y el canvas a
      // 1 px. Medido headless. Con el paso como base, ancho y radio son siempre
      // positivos sea cual sea el ancho del lienzo.
      const paso  = w / BARRAS;
      const hueco = paso * 0.34;
      const ancho = paso - hueco;
      const minima = Math.max(2, h * 0.06);
      const avance = au.duration ? au.currentTime / au.duration : 0;
      ctx2d.clearRect(0, 0, w, h);
      for (let i = 0; i < BARRAS; i++){
        let v, encendida = true;
        if (hayGrafo && !au.paused){
          // Las voces viven en los bins bajos: se recorren solo los dos
          // primeros tercios para que las barras altas no queden siempre planas.
          const bin = Math.floor(i / BARRAS * datos.length * 0.66);
          v = datos[bin] / 255;
        } else if (!hayGrafo){
          // Sin Web Audio la barra sigue el AVANCE, y el pie lo dice asi.
          v = REPOSO(i) * 2.4;
          encendida = (i / BARRAS) <= avance;
        } else {
          v = REPOSO(i);
        }
        // 0.9 y no 1: medido sobre la cortinilla completa, las barras tocaban el
        // 100% del lienzo en 18 de 44 muestras y ahi dejaban de distinguirse los
        // picos. Con ese techo queda aire y el pico se sigue leyendo.
        const alto = Math.max(minima, v * h * 0.9);
        const x = i * (ancho + hueco);
        ctx2d.fillStyle = !encendida ? 'rgba(183,194,217,.30)'
                        : v > 0.78   ? '#38EB6B' : '#4AB472';
        if (ctx2d.roundRect){
          ctx2d.beginPath();
          ctx2d.roundRect(x, (h - alto) / 2, ancho, alto, ancho / 2);
          ctx2d.fill();
        } else ctx2d.fillRect(x, (h - alto) / 2, ancho, alto);
      }
      if (reloj) reloj.textContent = mmss(au.currentTime) + ' / ' + mmss(au.duration);
    }

    function conectar(){
      if (audioCtx) return true;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC || !AC.prototype.createMediaElementSource) return false;
      try {
        audioCtx = new AC();
        analizador = audioCtx.createAnalyser();
        analizador.fftSize = 128;
        // La atenuacion SUAVIZA la onda, no la apaga: mas promediado, menos
        // parpadeo. Sigue siendo el espectro real.
        analizador.smoothingTimeConstant = suave ? 0.72 : 0.92;
        audioCtx.createMediaElementSource(au).connect(analizador);
        analizador.connect(audioCtx.destination);
        datos = new Uint8Array(analizador.frequencyBinCount);
        hayGrafo = true;
      } catch (e){ hayGrafo = false; }
      return hayGrafo;
    }

    const pintar = () => {
      if (hayGrafo) analizador.getByteFrequencyData(datos);
      dibujar();
      raf = requestAnimationFrame(pintar);
    };
    const detener = () => { cancelAnimationFrame(raf); raf = 0; dibujar(); };

    au.addEventListener('play',  () => { if (!raf) raf = requestAnimationFrame(pintar); });
    au.addEventListener('pause', detener);
    au.addEventListener('loadedmetadata', dibujar);
    au.addEventListener('ended', () => {
      au.currentTime = 0;
      btn.dataset.sonando = 'no';
      if (rotulo) rotulo.textContent = ROTULO;
      detener();
    });
    au.addEventListener('error', () => {
      if (pie) pie.textContent = 'No se pudo cargar el audio de la cortinilla.';
    });

    btn.addEventListener('click', () => {
      if (panel.hidden){
        panel.hidden = false;
        // Un elemento que acaba de dejar `display:none` no transiciona en el
        // mismo cuadro: hay que dejar pasar uno para que el estado inicial
        // exista antes de cambiarlo.
        requestAnimationFrame(() => panel.classList.add('abierta'));
        btn.setAttribute('aria-expanded', 'true');
        // Se re-mide AQUI: hasta este cuadro el panel estaba en `display:none` y
        // el canvas medía 0 de ancho. Sin esto, en un navegador sin
        // ResizeObserver la onda se dibujaría en un lienzo de 1 px.
        medir();
        // Si no hay Web Audio, las barras pasan a marcar el avance. El pie NO cambia
        // porque nunca prometio un espectro: dice que suena la cortinilla, y suena.
        conectar();
        dibujar();
      }
      if (au.paused){
        if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
        const p = au.play();
        /* play() rechaza por DOS motivos distintos y antes los dos decian que el
           navegador habia bloqueado la reproduccion. Si el archivo no carga,
           culpar al navegador manda a la persona a tocar otra vez un boton que
           nunca va a sonar. Solo NotAllowedError es un bloqueo de verdad. */
        if (p && p.catch) p.catch(err => {
          if (pie) pie.textContent = (err && err.name === 'NotAllowedError')
            ? 'El navegador bloqueó la reproducción. Vuelve a tocar el botón.'
            : 'No se pudo cargar el audio de la cortinilla.';
          btn.dataset.sonando = 'no';
          if (rotulo) rotulo.textContent = ROTULO;
        });
        btn.dataset.sonando = 'si';
        if (rotulo) rotulo.textContent = 'Pausa';
      } else {
        au.pause();
        btn.dataset.sonando = 'no';
        if (rotulo) rotulo.textContent = ROTULO;
      }
    });

    dibujar();
  }
}

/* ---------- acordeon ----------------------------------------------------- */
{
  $$('.faq__b').forEach(b => {
    b.addEventListener('click', () => {
      const item = b.closest('.faq__item');
      const abierto = item.dataset.abierto === 'si';
      $$('.faq__item').forEach(i => {
        i.dataset.abierto = 'no';
        $('.faq__b', i).setAttribute('aria-expanded', 'false');
      });
      if (!abierto){
        item.dataset.abierto = 'si';
        b.setAttribute('aria-expanded', 'true');
      }
    });
  });
}

/* ---------- 404: una sola barra ------------------------------------------
   La Z incompleta. Respira con la misma ecuacion que las 289 del catalogo,
   para que el error se sienta parte del sitio y no de otro sitio. */
{
  const cv = document.querySelector('.p404__barra');
  if (cv){
    const ctx = cv.getContext('2d');
    const dpr = Math.min(devicePixelRatio || 1, 2);
    cv.width = Math.round(26 * dpr); cv.height = Math.round(200 * dpr);
    const t0 = performance.now();
    const pintar = () => {
      const t = (performance.now() - t0) / 1000;
      const h = cv.height * (0.42 + Math.sin(t * 1.9) * 0.16);
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.fillStyle = '#4AB472';
      if (ctx.roundRect){
        ctx.beginPath();
        ctx.roundRect(0, cv.height - h, cv.width, h, cv.width / 2);
        ctx.fill();
      } else ctx.fillRect(0, cv.height - h, cv.width, h);
    };
    if (suave) loop(cv, pintar); else requestAnimationFrame(pintar);
  }
}

/* =========================================================================
   MECANICA — heartbeat-scroll-line  (HILO de todo el sitio)
   Una pista de audio dibujada por el scroll, con cabeza de lectura fija a
   media pantalla: lo que queda arriba de la cabeza ya sono y va en verde
   brillo; lo de abajo todavia no y va en verde apagado.
   El RITMO lo dicta la seccion, no un reloj: las superficies de sonido
   (data-superficie="noche") laten con el doble de frecuencia y mas del doble
   de amplitud que las de lectura, y cada seccion arranca con una espiga. Asi
   la linea dice donde estas sin escribir una palabra.
   Se pinta en canvas de 34x100vh (14 px en telefono), solo cuando el scroll
   cambia y siempre dentro de un rAF, para no pintar dos veces en el mismo
   cuadro.
   ========================================================================= */
{
  const cv = $('.pulso__lienzo');
  if (cv){
    const ctx = cv.getContext('2d');
    let W = 0, H = 0, tramos = [], pedido = 0;

    function medir(){
      const dpr = Math.min(devicePixelRatio || 1, 2);
      W = cv.parentElement.clientWidth;
      H = innerHeight;
      cv.style.width = W + 'px'; cv.style.height = H + 'px';
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      /* Las franjas se miden UNA vez por resize y no por cuadro: son 9 rects y
         leerlos en cada scroll obligaria a un layout por cuadro. */
      tramos = $$('main .seccion').map(s => {
        const r = s.getBoundingClientRect();
        return { y0: r.top + scrollY, y1: r.bottom + scrollY,
                 fuerte: s.dataset.superficie === 'noche' };
      });
    }

    function tramoEn(y){
      for (let i = 0; i < tramos.length; i++) if (y < tramos[i].y1) return tramos[i];
      return tramos[tramos.length - 1];
    }

    /* La onda: dos senos desfasados (para que no se lea como un seno de libro de
       texto) por una envolvente que se apaga en los bordes del tramo, mas la
       espiga de arranque. Sin la envolvente, el cambio de ritmo entre secciones
       era un escalon feo justo encima de la costura. */
    function onda(y){
      const t = tramoEn(y);
      if (!t) return 0;
      const borde = clamp(Math.min(y - t.y0, t.y1 - y) / 140, 0, 1);
      const amp = (t.fuerte ? 1 : 0.42) * borde;
      const f   = t.fuerte ? 0.050 : 0.020;
      const d   = y - t.y0 - 120;
      return amp * (0.64 * Math.sin(y * f) + 0.36 * Math.sin(y * f * 2.7 + 1.1)
                    + 1.9 * Math.exp(-(d * d) / 900));
    }

    const K  = () => W * 0.17;
    const eX = (dy) => W / 2 + clamp(onda(dy), -2.6, 2.6) * K();

    function trazo(hasta){
      ctx.beginPath();
      for (let vy = 0; vy <= hasta; vy += 2){
        const x = eX(scrollY + vy);
        if (vy === 0) ctx.moveTo(x, vy); else ctx.lineTo(x, vy);
      }
      ctx.stroke();
    }

    function pintar(){
      pedido = 0;
      if (!tramos.length) return;
      ctx.clearRect(0, 0, W, H);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      /* El trazo completo primero, en verde de marca al 34%: ese valor se eligio
         midiendo sobre las DOS superficies, porque la pista las cruza. */
      ctx.strokeStyle = 'rgba(74,180,114,.34)'; ctx.lineWidth = 1.4;
      trazo(H);
      if (!suave) return;
      /* Lo ya escuchado, encima y mas grueso. */
      ctx.strokeStyle = 'rgba(56,235,107,.92)'; ctx.lineWidth = 1.8;
      trazo(H / 2);
      ctx.fillStyle = '#38EB6B';
      ctx.beginPath(); ctx.arc(eX(scrollY + H / 2), H / 2, 2.6, 0, 6.2832); ctx.fill();
    }

    const pedir = () => { if (!pedido) pedido = requestAnimationFrame(pintar); };
    const rehacer = () => { medir(); pintar(); };

    medir(); pintar();
    addEventListener('scroll', pedir, { passive: true });
    addEventListener('resize', rehacer);
    /* El alto del documento crece cuando entran las fuentes y las imagenes
       diferidas: sin esto las franjas se quedan con las medidas del primer
       cuadro y el ritmo se desfasa media pantalla. */
    addEventListener('load', rehacer);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(rehacer);
  }
}

/* ---------- anio del pie ------------------------------------------------- */
{ const a = $('#anio'); if (a) a.textContent = new Date().getFullYear(); }

})();
