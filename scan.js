/* ============================================================
   Biometric fingerprint-scan animation — vanilla port of
   design_handoff_scan_feedback/README.md ("calm amoeba, core right").
   Geometry, seed, colors, and timings match the spec exactly.

   createScan(mountEl, opts) -> {
     setProgress(p, order)  // p in -1..1; drives the organic fill
     fail()                 // error color swap + horizontal shake
     succeed()              // springy 1.05 success pulse
     reset()                // clear fills + color + transform
     loop(opts)             // run the spec's idle→fail→retry→success cycle
     stop()                 // cancel a running loop
   }
   ============================================================ */
(function () {
  const NS = "http://www.w3.org/2000/svg";
  let stylesInjected = false;

  function injectStyles() {
    if (stylesInjected) return;
    stylesInjected = true;
    const css = `
      @keyframes fpShake {
        0%,100% { transform: translateX(0); }
        20% { transform: translateX(-7px); }
        40% { transform: translateX(6px); }
        60% { transform: translateX(-4px); }
        80% { transform: translateX(3px); }
      }
      .scan__svg {
        display: block;
        transform-origin: center;
        transition: transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1);
      }
      @media (prefers-reduced-motion: reduce) {
        .scan__svg { transition: none; }
      }`;
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
  }

  function genSegments() {
    // deterministic PRNG (LCG), seed 288 — identical shape every run
    let seed = 288;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const segs = [];
    const rings = 9;
    for (let i = 0; i < rings; i++) {
      let a = rnd() * Math.PI * 2;
      let covered = 0;
      while (covered < Math.PI * 2 - 0.25) {
        const len = 0.45 + rnd() * 0.95;
        const gap = 0.12 + rnd() * 0.24;
        const steps = Math.max(3, Math.round(len / 0.06));
        const pts = [];
        for (let k = 0; k <= steps; k++) {
          const t = a + (len * k) / steps;
          const r = (12 + i * 8.0) *
            (1 + 0.14 * Math.sin(2 * t + 1.1) + 0.08 * Math.sin(3 * t - 0.4) + 0.04 * Math.sin(5 * t + 2));
          const drift = (8 - i) * 3.0;
          const x = 100 + 0.75 * drift + r * 0.86 * Math.cos(t);
          const y = 128 + 0.08 * drift + r * 0.90 * Math.sin(t);
          pts.push([x, y]);
        }
        const d = "M" + pts.map((p) => p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" L");
        segs.push({ d, midY: pts[Math.floor(pts.length / 2)][1], rand: rnd() });
        a += len + gap;
        covered += len + gap;
      }
    }
    return segs;
  }

  window.createScan = function createScan(mount, opts) {
    opts = opts || {};
    const baseColor = opts.baseColor || "#ABB0B3";
    const fillColor = opts.fillColor || "#332E30";
    const errorColor = opts.errorColor || "#B33F3F";
    const width = opts.width || 3;
    injectStyles();

    const segs = genSegments();
    const minY = Math.min.apply(null, segs.map((s) => s.midY));
    const maxY = Math.max.apply(null, segs.map((s) => s.midY));
    const span = (maxY - minY) || 1;

    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 200 260");
    svg.setAttribute("class", "scan__svg");
    svg.setAttribute("aria-hidden", "true");

    const gBase = document.createElementNS(NS, "g");
    const gFill = document.createElementNS(NS, "g");
    const fillPaths = [];
    for (const s of segs) {
      const pb = document.createElementNS(NS, "path");
      pb.setAttribute("d", s.d);
      pb.setAttribute("fill", "none");
      pb.setAttribute("stroke", baseColor);
      pb.setAttribute("stroke-width", width);
      pb.setAttribute("stroke-linecap", "round");
      gBase.appendChild(pb);

      const pf = document.createElementNS(NS, "path");
      pf.setAttribute("d", s.d);
      pf.setAttribute("fill", "none");
      pf.setAttribute("stroke", fillColor);
      pf.setAttribute("stroke-width", width);
      pf.setAttribute("stroke-linecap", "round");
      pf.setAttribute("opacity", "0");
      pf.style.transition = "opacity 0.5s ease, stroke 0.25s ease";
      gFill.appendChild(pf);
      fillPaths.push(pf);
    }
    svg.appendChild(gBase);
    svg.appendChild(gFill);
    mount.appendChild(svg);

    let failed = false;
    let loopTimers = [];
    let raf = 0;

    function setColor(c) { fillPaths.forEach((p) => p.setAttribute("stroke", c)); }
    function apply(p, order) {
      for (let i = 0; i < segs.length; i++) {
        const t = order === "sweep" ? (segs[i].midY - minY) / span : segs[i].rand;
        fillPaths[i].setAttribute("opacity", t <= p ? "1" : "0");
      }
    }

    const api = {
      el: svg,
      setProgress(p, order) {
        if (failed) { failed = false; setColor(fillColor); }
        apply(p, order);
      },
      fail() {
        failed = true;
        setColor(errorColor);
        svg.style.animation = "fpShake 0.45s ease";
        setTimeout(() => { svg.style.animation = "none"; }, 460);
      },
      succeed() { svg.style.transform = "scale(1.05)"; },
      reset() {
        failed = false;
        setColor(fillColor);
        apply(-1);
        svg.style.transform = "scale(1)";
      },
      stop() {
        loopTimers.forEach(clearTimeout);
        loopTimers = [];
        cancelAnimationFrame(raf);
      },
      // faithful spec cycle: idle → attempt1 fails → error → pause → attempt2 succeeds → pulse → reset → loop
      loop(o) {
        o = o || {};
        const sp = o.speed || 1;
        const includeFailure = o.includeFailure !== false;
        const order = o.fillOrder || "organic";
        const run = (attempt) => {
          const withFail = includeFailure && attempt === 0;
          api.reset();
          loopTimers.push(setTimeout(() => {
            const target = withFail ? 0.66 : 1;
            const t0 = performance.now();
            const tick = (now) => {
              const p = Math.min(target, (now - t0) / (2400 / sp));
              apply(p, order);
              if (p < target) { raf = requestAnimationFrame(tick); return; }
              if (withFail) {
                api.fail();
                loopTimers.push(setTimeout(() => {
                  api.reset();
                  loopTimers.push(setTimeout(() => run(1), 1000 / sp));
                }, 1300 / sp));
              } else {
                api.succeed();
                loopTimers.push(setTimeout(() => {
                  api.reset();
                  loopTimers.push(setTimeout(() => run(0), 1100 / sp));
                }, 1500 / sp));
              }
            };
            raf = requestAnimationFrame(tick);
          }, 900 / sp));
        };
        api.stop();
        run(0);
      },
    };
    return api;
  };
})();
