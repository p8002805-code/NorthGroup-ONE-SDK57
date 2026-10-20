export const MAX_DXF_PREVIEW_BYTES = 10 * 1024 * 1024;
const MAX_DXF_ENTITIES = 30000;

const numberValue = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const firstGroup = (record, code, fallback = '') => (
  record.groups.find((group) => group.code === code)?.value ?? fallback
);

const allGroups = (record, code) => record.groups
  .filter((group) => group.code === code)
  .map((group) => group.value);

const parseEntityRecords = (text) => {
  const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/);
  const pairs = [];
  for (let index = 0; index + 1 < lines.length; index += 2) {
    const code = Number.parseInt(lines[index].trim(), 10);
    if (Number.isInteger(code)) pairs.push({ code, value: lines[index + 1].trimEnd() });
  }

  const records = [];
  let inEntities = false;
  let current = null;
  for (let index = 0; index < pairs.length; index += 1) {
    const pair = pairs[index];
    if (!inEntities) {
      if (pair.code === 0 && pair.value.trim().toUpperCase() === 'SECTION') {
        const next = pairs[index + 1];
        if (next?.code === 2 && next.value.trim().toUpperCase() === 'ENTITIES') {
          inEntities = true;
          index += 1;
        }
      }
      continue;
    }
    if (pair.code === 0) {
      if (current) records.push(current);
      const type = pair.value.trim().toUpperCase();
      if (type === 'ENDSEC') break;
      current = { type, groups: [] };
      if (records.length > MAX_DXF_ENTITIES) {
        throw new Error('This DXF contains too many entities for a safe mobile preview.');
      }
    } else if (current) {
      current.groups.push(pair);
    }
  }
  if (!records.length) throw new Error('No drawable DXF entities were found.');
  return records;
};

const recordsToPrimitives = (records) => {
  const primitives = [];
  let activePolyline = null;

  records.forEach((record) => {
    if (record.type === 'POLYLINE') {
      activePolyline = {
        type: 'polyline',
        points: [],
        closed: (numberValue(firstGroup(record, 70)) & 1) === 1,
      };
      return;
    }
    if (record.type === 'VERTEX' && activePolyline) {
      activePolyline.points.push({
        x: numberValue(firstGroup(record, 10)),
        y: numberValue(firstGroup(record, 20)),
      });
      return;
    }
    if (record.type === 'SEQEND' && activePolyline) {
      if (activePolyline.points.length > 1) primitives.push(activePolyline);
      activePolyline = null;
      return;
    }

    if (record.type === 'LINE') {
      primitives.push({
        type: 'line',
        x1: numberValue(firstGroup(record, 10)),
        y1: numberValue(firstGroup(record, 20)),
        x2: numberValue(firstGroup(record, 11)),
        y2: numberValue(firstGroup(record, 21)),
      });
    } else if (record.type === 'CIRCLE') {
      primitives.push({
        type: 'circle',
        x: numberValue(firstGroup(record, 10)),
        y: numberValue(firstGroup(record, 20)),
        radius: Math.abs(numberValue(firstGroup(record, 40))),
      });
    } else if (record.type === 'ARC') {
      primitives.push({
        type: 'arc',
        x: numberValue(firstGroup(record, 10)),
        y: numberValue(firstGroup(record, 20)),
        radius: Math.abs(numberValue(firstGroup(record, 40))),
        start: numberValue(firstGroup(record, 50)),
        end: numberValue(firstGroup(record, 51)),
      });
    } else if (record.type === 'POINT') {
      primitives.push({
        type: 'point',
        x: numberValue(firstGroup(record, 10)),
        y: numberValue(firstGroup(record, 20)),
      });
    } else if (record.type === 'LWPOLYLINE') {
      const xs = allGroups(record, 10);
      const ys = allGroups(record, 20);
      const points = xs.map((x, index) => ({ x: numberValue(x), y: numberValue(ys[index]) }));
      if (points.length > 1) {
        primitives.push({
          type: 'polyline',
          points,
          closed: (numberValue(firstGroup(record, 70)) & 1) === 1,
        });
      }
    } else if (record.type === 'TEXT' || record.type === 'MTEXT') {
      primitives.push({
        type: 'text',
        x: numberValue(firstGroup(record, 10)),
        y: numberValue(firstGroup(record, 20)),
        text: String(firstGroup(record, 1) || firstGroup(record, 3) || '').slice(0, 180),
      });
    }
  });
  if (activePolyline?.points.length > 1) primitives.push(activePolyline);
  if (!primitives.length) throw new Error('This DXF uses entities that the mobile preview does not yet support.');
  return primitives;
};

const escapeJson = (value) => JSON.stringify(value)
  .replace(/</g, '\\u003c')
  .replace(/\u2028/g, '\\u2028')
  .replace(/\u2029/g, '\\u2029');

export const buildDxfPreviewHtml = (text) => {
  const primitives = recordsToPrimitives(parseEntityRecords(text));
  const payload = escapeJson(primitives);
  return `<!doctype html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'">
<style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#09131d}canvas{display:block;width:100%;height:100%;touch-action:none}.fit{position:fixed;right:14px;bottom:18px;border:1px solid #d9a928;border-radius:18px;padding:8px 13px;background:#102438;color:#fff;font:700 12px system-ui}</style></head>
<body><canvas id="cad"></canvas><button class="fit" id="fit">FIT</button><script>
const shapes=${payload};const canvas=document.getElementById('cad');const ctx=canvas.getContext('2d');let scale=1,ox=0,oy=0,drag=null;
const pts=[];shapes.forEach(s=>{if(s.type==='line')pts.push([s.x1,s.y1],[s.x2,s.y2]);else if(s.points)s.points.forEach(p=>pts.push([p.x,p.y]));else if(s.x!==undefined){const r=s.radius||0;pts.push([s.x-r,s.y-r],[s.x+r,s.y+r]);}});
let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;pts.forEach(a=>{minX=Math.min(minX,a[0]);maxX=Math.max(maxX,a[0]);minY=Math.min(minY,a[1]);maxY=Math.max(maxY,a[1])});if(!isFinite(minX)){minX=minY=0;maxX=maxY=1;}
function resize(){const d=Math.min(devicePixelRatio||1,2);canvas.width=innerWidth*d;canvas.height=innerHeight*d;canvas.style.width=innerWidth+'px';canvas.style.height=innerHeight+'px';ctx.setTransform(d,0,0,d,0,0);draw();}
function fit(){const w=Math.max(1,maxX-minX),h=Math.max(1,maxY-minY);scale=Math.min((innerWidth-36)/w,(innerHeight-72)/h);ox=(innerWidth-w*scale)/2-minX*scale;oy=(innerHeight-h*scale)/2+maxY*scale;draw();}
function p(x,y){return[x*scale+ox,oy-y*scale]};function draw(){ctx.clearRect(0,0,innerWidth,innerHeight);ctx.lineWidth=1.25;ctx.strokeStyle='#e8edf2';ctx.fillStyle='#e8edf2';ctx.lineCap='round';ctx.lineJoin='round';shapes.forEach(s=>{ctx.beginPath();if(s.type==='line'){const a=p(s.x1,s.y1),b=p(s.x2,s.y2);ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();}else if(s.type==='polyline'){s.points.forEach((v,i)=>{const a=p(v.x,v.y);i?ctx.lineTo(...a):ctx.moveTo(...a)});if(s.closed)ctx.closePath();ctx.stroke();}else if(s.type==='circle'){const a=p(s.x,s.y);ctx.arc(a[0],a[1],Math.abs(s.radius*scale),0,Math.PI*2);ctx.stroke();}else if(s.type==='arc'){const a=p(s.x,s.y);ctx.arc(a[0],a[1],Math.abs(s.radius*scale),-s.start*Math.PI/180,-s.end*Math.PI/180,true);ctx.stroke();}else if(s.type==='point'){const a=p(s.x,s.y);ctx.moveTo(a[0]-3,a[1]);ctx.lineTo(a[0]+3,a[1]);ctx.moveTo(a[0],a[1]-3);ctx.lineTo(a[0],a[1]+3);ctx.stroke();}else if(s.type==='text'&&s.text){const a=p(s.x,s.y);ctx.font='11px monospace';ctx.fillText(s.text,a[0],a[1]);}})}
canvas.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,ox,oy};canvas.setPointerCapture(e.pointerId)});canvas.addEventListener('pointermove',e=>{if(!drag)return;ox=drag.ox+e.clientX-drag.x;oy=drag.oy+e.clientY-drag.y;draw()});canvas.addEventListener('pointerup',()=>drag=null);canvas.addEventListener('pointercancel',()=>drag=null);canvas.addEventListener('wheel',e=>{e.preventDefault();const before=[(e.clientX-ox)/scale,(oy-e.clientY)/scale];scale*=e.deltaY<0?1.15:.87;ox=e.clientX-before[0]*scale;oy=e.clientY+before[1]*scale;draw()},{passive:false});
document.getElementById('fit').onclick=fit;addEventListener('resize',resize);resize();fit();
</script></body></html>`;
};
