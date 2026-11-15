// Working-principle diagrams, redrawn as SVG from the company's product catalogue.
// Labels inside the drawings are language-neutral (letters, numbers); explanations live in the page legend.

const f = n => Number(n.toFixed(1));

function arrow(x1, y1, x2, y2) {
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const head = [[0, 0], [-11, -6], [-11, 6]].map(([dx, dy]) =>
    `${f(x2 + dx * Math.cos(ang) - dy * Math.sin(ang))},${f(y2 + dx * Math.sin(ang) + dy * Math.cos(ang))}`).join(' ');
  return `<line class="dg-arrow" x1="${x1}" y1="${y1}" x2="${f(x2 - 9 * Math.cos(ang))}" y2="${f(y2 - 9 * Math.sin(ang))}"/><polygon class="dg-arrowhead" points="${head}"/>`;
}

const text = (x, y, s, cls = 'dg-text', anchor = 'middle') =>
  `<text class="${cls}" x="${x}" y="${y}" text-anchor="${anchor}">${s}</text>`;

// Closed outline of a polar curve r(θ); θ grows clockwise on screen (SVG y points down).
function polar(cx, cy, r) {
  const pts = [];
  for (let d = 0; d < 360; d += 3) {
    const t = d * Math.PI / 180;
    const rr = r(t);
    pts.push(`${f(cx + rr * Math.cos(t))},${f(cy + rr * Math.sin(t))}`);
  }
  return `M${pts.join('L')}Z`;
}

// Two overlapping round chambers joined by inlet/outlet channels, as in the catalogue drawings.
function twinChamber(ox, { width, topY, botY, r, wallTop, wallBot }) {
  const cx = ox + width / 2;
  const dxTop = Math.sqrt(r * r - (wallTop - topY) ** 2);
  const dxBot = Math.sqrt(r * r - (botY - wallBot) ** 2);
  const L = ox + 4, R = ox + width - 4;
  const upper = `M${L},${wallTop}H${f(cx - dxTop)}A${r},${r} 0 1,1 ${f(cx + dxTop)},${wallTop}H${R}`;
  const lower = `M${L},${wallBot}H${f(cx - dxBot)}A${r},${r} 0 1,0 ${f(cx + dxBot)},${wallBot}H${R}`;
  const fill = `${upper}V${wallBot}H${f(cx + dxBot)}A${r},${r} 0 1,1 ${f(cx - dxBot)},${wallBot}H${L}Z`;
  return { upper, lower, fill, cx };
}

function svg(viewBox, body, label) {
  return `<svg class="diagram" viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${label}">${body}</svg>`;
}

/* ── Oval gear meter: stages (a)–(c) of one rotation (also used by the LC-W miniature meter) ── */
export function ovalGear(label) {
  const W = 200, a = 44, b = 20, r = 46;
  const panels = ['(a)', '(b)', '(c)'].map((stage, i) => {
    const ox = i * 210, cx = ox + 100, cyA = 132, cyB = 68;
    const h = twinChamber(ox, { width: W, topY: cyB, botY: cyA, r, wallTop: 92, wallBot: 108 });
    const rotA = [0, -45, -90][i], rotB = [0, 45, 90][i];
    // Crescent of liquid trapped between a gear and its chamber wall.
    const lowCrescent = `M${cx - r},${cyA}A${r},${r} 0 0,0 ${cx + r},${cyA}L${cx + a},${cyA}A${a},${b} 0 0,1 ${cx - a},${cyA}Z`;
    const topCrescent = `M${cx - r},${cyB}A${r},${r} 0 0,1 ${cx + r},${cyB}L${cx + a},${cyB}A${a},${b} 0 0,0 ${cx - a},${cyB}Z`;
    const fluid = i < 2
      ? `<path class="dg-fluid" d="${lowCrescent}" transform="rotate(${rotA} ${cx} ${cyA})"/>`
      : `<path class="dg-fluid" d="${topCrescent}"/>`;
    const pressure = i === 0
      ? text(ox + 22, 86, 'P<tspan class="dg-sub" dy="4">1</tspan>', 'dg-text dg-italic') + text(ox + 170, 86, 'P<tspan class="dg-sub" dy="4">2</tspan>', 'dg-text dg-italic')
      : '';
    return `<g>
      ${fluid}
      <path class="dg-wall" d="${h.upper}"/><path class="dg-wall" d="${h.lower}"/>
      <ellipse class="dg-gear-a" cx="${cx}" cy="${cyA}" rx="${a}" ry="${b}" transform="rotate(${rotA} ${cx} ${cyA})"/>
      <ellipse class="dg-gear-b" cx="${cx}" cy="${cyB}" rx="${b}" ry="${a}" transform="rotate(${rotB} ${cx} ${cyB})"/>
      <circle class="dg-hub" cx="${cx}" cy="${cyA}" r="9"/><circle class="dg-hub" cx="${cx}" cy="${cyB}" r="9"/>
      ${text(cx, cyA + 4.5, 'A', 'dg-hub-text')}${text(cx, cyB + 4.5, 'B', 'dg-hub-text')}
      ${arrow(ox + 8, 100, ox + 46, 100)}${arrow(ox + 154, 100, ox + 194, 100)}
      ${pressure}
      ${text(cx, 200, stage)}
    </g>`;
  }).join('');
  return svg('0 -4 620 214', panels, label);
}

/* ── Helical dual rotor: positions A–E as the rotor pair turns ── */
export function helicalRotor(label) {
  const W = 180, topY = 60, botY = 116;
  const panels = ['A', 'B', 'C', 'D', 'E'].map((stage, i) => {
    const ox = i * 186, phi = i * 18 * Math.PI / 180;
    const h = twinChamber(ox, { width: W, topY, botY, r: 42, wallTop: 80, wallBot: 96 });
    // Four-lobed rotors; the lower one is offset by half a lobe so the pair meshes, and turns the other way.
    const top = polar(h.cx, topY, t => 28 + 10 * Math.cos(4 * (t - phi)));
    const bottom = polar(h.cx, botY, t => 28 + 10 * Math.cos(4 * (t + phi) - Math.PI));
    const callouts = i === 0 ? `
      <line class="dg-leader" x1="${h.cx + 22}" y1="${topY - 26}" x2="${h.cx + 48}" y2="14"/>${text(h.cx + 54, 16, '1', 'dg-num-plain', 'start')}
      <line class="dg-leader" x1="${h.cx + 22}" y1="${botY + 26}" x2="${h.cx + 48}" y2="172"/>${text(h.cx + 54, 176, '2', 'dg-num-plain', 'start')}
      <line class="dg-leader" x1="${h.cx - 36}" y1="${botY + 18}" x2="${h.cx - 60}" y2="172"/>${text(h.cx - 66, 176, '3', 'dg-num-plain', 'end')}
      <line class="dg-leader" x1="${ox + 22}" y1="88" x2="${ox + 14}" y2="30"/>${text(ox + 14, 24, '4', 'dg-num-plain')}` : '';
    return `<g>
      <path class="dg-fluid" d="${h.fill}"/>
      <path class="dg-wall" d="${h.upper}"/><path class="dg-wall" d="${h.lower}"/>
      <path class="dg-rotor" d="${top}"/><path class="dg-rotor" d="${bottom}"/>
      <circle class="dg-hub" cx="${h.cx}" cy="${topY}" r="5"/><circle class="dg-hub" cx="${h.cx}" cy="${botY}" r="5"/>
      ${callouts}
      ${text(h.cx, 198, stage)}
    </g>`;
  }).join('');
  return svg('0 0 924 206', panels, label);
}

/* ── Roots (lobed-impeller) meter: positions (a)–(d), 45° apart ── */
export function rootsMeter(label) {
  const W = 180, topY = 68, botY = 120;
  const panels = ['(a)', '(b)', '(c)', '(d)'].map((stage, i) => {
    const ox = i * 186, phi = i * Math.PI / 4;
    const h = twinChamber(ox, { width: W, topY, botY, r: 38, wallTop: 86, wallBot: 102 });
    const top = polar(h.cx, topY, t => 26 + 10 * Math.cos(2 * (t - phi)));
    const bottom = polar(h.cx, botY, t => 26 + 10 * Math.cos(2 * (t + phi) - Math.PI));
    return `<g>
      <path class="dg-fluid" d="${h.fill}"/>
      <path class="dg-wall" d="${h.upper}"/><path class="dg-wall" d="${h.lower}"/>
      <path class="dg-rotor" d="${top}"/><path class="dg-rotor" d="${bottom}"/>
      <circle class="dg-hub" cx="${h.cx}" cy="${topY}" r="5"/><circle class="dg-hub" cx="${h.cx}" cy="${botY}" r="5"/>
      ${i === 0 ? arrow(ox + 2, 94, ox + 34, 94) : ''}
      ${text(h.cx, 186, stage)}
    </g>`;
  }).join('');
  return svg('0 0 738 194', panels, label);
}

/* ── Turbine flowmeter: impeller, magnetic pickup, amplifier, pulse output ── */
export function turbinePrinciple(label) {
  const blades = [-24, -8, 8, 24].map(x => {
    const cx = 320 + x;
    return `<polygon class="dg-gear-a" points="${cx - 6},118 ${cx + 4},118 ${cx + 12},96 ${cx + 2},96"/>
      <polygon class="dg-gear-a" points="${cx - 6},142 ${cx + 4},142 ${cx - 4},164 ${cx - 14},164"/>`;
  }).join('');
  const coil = [0, 1, 2, 3, 4].map(k => `<ellipse class="dg-coil" cx="320" cy="${56 + k * 6}" rx="11" ry="3"/>`).join('');
  const pulses = 'M530,52 H542 V30 H556 V52 H570 V30 H584 V52 H598 V30 H612 V52 H624';
  const num = (x, y, n) => `<circle class="dg-num-bg" cx="${x}" cy="${y}" r="11"/>${text(x, y + 5, n, 'dg-num')}`;
  const body = `
    <rect class="dg-fluid" x="125" y="92" width="390" height="76"/>
    <rect class="dg-flange" x="108" y="74" width="18" height="112" rx="2"/><rect class="dg-flange" x="514" y="74" width="18" height="112" rx="2"/>
    <line class="dg-wall" x1="126" y1="92" x2="514" y2="92"/><line class="dg-wall" x1="126" y1="168" x2="514" y2="168"/>
    <line class="dg-shaft" x1="236" y1="130" x2="404" y2="130"/>
    <line class="dg-shaft" x1="236" y1="96" x2="236" y2="164"/><line class="dg-shaft" x1="404" y1="96" x2="404" y2="164"/>
    <rect class="dg-hub-rect" x="290" y="118" width="60" height="24" rx="6"/>
    ${blades}
    <rect class="dg-pickup" x="304" y="40" width="32" height="52" rx="3"/>
    ${coil}
    <rect class="dg-magnet" x="312" y="80" width="16" height="10"/>
    <polyline class="dg-wire" points="320,40 320,28 420,28 420,40"/>
    <rect class="dg-box" x="404" y="40" width="96" height="40" rx="4"/>
    <polyline class="dg-wire-thin" points="414,70 424,70 424,50 434,50 434,70 444,70 444,50 454,50"/>
    <path class="dg-amp" d="M466,48 L490,60 L466,72 Z"/>
    ${arrow(500, 60, 528, 60)}
    <path class="dg-pulse" d="${pulses}"/>
    ${arrow(20, 130, 100, 130)}
    <path class="dg-rot" d="M352,104 A34,34 0 0,1 352,156"/><polygon class="dg-arrowhead" points="352,156 344,146 356,147"/>
    ${num(150, 210, '1')}<line class="dg-leader" x1="150" y1="199" x2="150" y2="168"/>
    ${num(270, 210, '2')}<line class="dg-leader" x1="270" y1="199" x2="300" y2="160"/>
    ${num(272, 40, '3')}<line class="dg-leader" x1="283" y1="44" x2="304" y2="56"/>
    ${num(452, 104, '4')}<line class="dg-leader" x1="452" y1="93" x2="452" y2="80"/>
    ${num(578, 84, '5')}<line class="dg-leader" x1="578" y1="73" x2="578" y2="56"/>`;
  return svg('0 10 640 216', body, label);
}

/* ── Turbine flowmeter: typical installation piping (catalogue figure 7) ── */
export function turbineInstall(label) {
  const valve = (x, y, vertical = false) => vertical
    ? `<polygon class="dg-valve" points="${x - 9},${y - 10} ${x + 9},${y - 10} ${x - 9},${y + 10} ${x + 9},${y + 10}"/>`
    : `<polygon class="dg-valve" points="${x - 10},${y - 9} ${x - 10},${y + 9} ${x + 10},${y - 9} ${x + 10},${y + 9}"/>`;
  const num = (x, y, n) => `<circle class="dg-num-bg" cx="${x}" cy="${y}" r="11"/>${text(x, y + 5, n, 'dg-num')}`;
  const pipe = (x1, y1, x2, y2) => `<line class="dg-pipe" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  const body = `
    ${pipe(40, 60, 620, 60)}
    ${pipe(80, 60, 80, 150)}${pipe(80, 150, 580, 150)}${pipe(580, 150, 580, 60)}
    ${arrow(4, 60, 38, 60)}
    ${valve(112, 60)}${valve(548, 60)}${valve(330, 150)}
    <rect class="dg-box" x="152" y="42" width="36" height="36" rx="3"/><path class="dg-mesh" d="M152,42 L188,78 M188,42 L152,78 M170,42 V78 M152,60 H188"/>
    <rect class="dg-box" x="208" y="46" width="34" height="30" rx="3"/><path class="dg-box" d="M212,46 A13,13 0 0,1 238,46 Z"/>
    <rect class="dg-sensor" x="388" y="46" width="40" height="28" rx="3"/><rect class="dg-pickup" x="402" y="30" width="12" height="16" rx="2"/>
    <line class="dg-dim" x1="262" y1="84" x2="378" y2="84"/><line class="dg-dim" x1="262" y1="78" x2="262" y2="90"/><line class="dg-dim" x1="378" y1="78" x2="378" y2="90"/>
    ${text(320, 102, '≥ 20D', 'dg-label')}
    <line class="dg-dim" x1="438" y1="84" x2="528" y2="84"/><line class="dg-dim" x1="438" y1="78" x2="438" y2="90"/><line class="dg-dim" x1="528" y1="78" x2="528" y2="90"/>
    ${text(483, 102, '≥ 5D', 'dg-label')}
    ${num(56, 30, '1')}${num(112, 30, '2')}${num(548, 30, '2')}${num(330, 180, '2')}
    ${num(170, 22, '3')}${num(225, 22, '4')}${num(320, 30, '5')}${num(408, 12, '6')}${num(483, 30, '7')}${num(200, 180, '8')}`;
  return svg('0 0 640 196', body, label);
}

export const DIAGRAMS = { ovalGear, helicalRotor, rootsMeter, turbinePrinciple, turbineInstall };
