let DATA=[];
const $=id=>document.getElementById(id);
const pct=x=>Number(x).toFixed(1)+"%";

async function getData(){
  DATA=await fetch("/data/state_data.csv").then(r=>r.text()).then(parseCSV);
}
function parseCSV(text){
  const lines=text.trim().split(/\r?\n/);
  const headers=lines[0].split(",");
  return lines.slice(1).map(line=>{
    const v=line.split(",");
    const o={};
    headers.forEach((h,i)=>o[h]=isNaN(Number(v[i]))||v[i]===""?v[i]:Number(v[i]));
    return o;
  });
}
function renderKpis(){
  const generated=DATA.reduce((a,x)=>a+x.waste_generated_tpd,0);
  const collected=DATA.reduce((a,x)=>a+x.waste_collected_tpd,0);
  const processed=DATA.reduce((a,x)=>a+x.waste_processed_tpd,0);
  const mean=DATA.reduce((a,x)=>a+x.compression_efficiency_pct,0)/DATA.length;
  const xs=DATA.map(x=>x.waste_generated_tpd), ys=DATA.map(x=>x.simulated_processing_time_s);
  const r=pearson(xs,ys);
  $("kpis").innerHTML=[
    ["STATES",DATA.length,"analysed"],
    ["GENERATED",generated.toLocaleString(),"tonnes/day"],
    ["PROCESSED",processed.toLocaleString(),"tonnes/day"],
    ["AVG COMPRESSION",pct(mean),"educational simulation*"],
    ["PEARSON r",r.toFixed(3),"generation vs model time*"]
  ].map(x=>`<div class="kpi"><small>${x[0]}</small><div class="num">${x[1]}</div><small>${x[2]}</small></div>`).join("");
}
function pearson(x,y){
  const mx=x.reduce((a,b)=>a+b,0)/x.length,my=y.reduce((a,b)=>a+b,0)/y.length;
  let n=0,d1=0,d2=0;
  for(let i=0;i<x.length;i++){let a=x[i]-mx,b=y[i]-my;n+=a*b;d1+=a*a;d2+=b*b;}
  return n/Math.sqrt(d1*d2);
}
function drawBar(canvas, items, key1, key2) {
  const c = canvas;
  const ctx = c.getContext("2d");
  
  // Use offsetWidth / clientWidth or default to 600
  const w = c.parentElement ? c.parentElement.clientWidth : (c.clientWidth || 600);
  const h = 300; 
  const dpr = window.devicePixelRatio || 1;

  // Set physical display size via CSS styling to lock height
  c.style.width = w + "px";
  c.style.height = h + "px";

  // Set internal canvas resolution
  c.width = w * dpr;
  c.height = h * dpr;

  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  const max = Math.max(...items.map(x => +x[key1] || 0));
  const bw = Math.max(12, (w - 50) / items.length - 8);

  items.forEach((x, i) => {
    const val = +x[key1] || 0;
    const bh = max > 0 ? (h - 55) * val / max : 0;
    const xx = 35 + i * (bw + 8);
    const yy = h - 35 - bh;

    ctx.fillStyle = "#68e0ad";
    ctx.fillRect(xx, yy, bw, bh);

    ctx.fillStyle = "#8fa99f";
    ctx.font = "10px Segoe UI";
    ctx.save();
    ctx.translate(xx + bw / 2, h - 10);
    ctx.rotate(-0.65);
    ctx.textAlign = "right";
    ctx.fillText(x[key2], 0, 0);
    ctx.restore();
  });
}
function renderRanks(){
  const p=DATA.slice().sort((a,b)=>b.processing_efficiency_pct-a.processing_efficiency_pct).slice(0,5);
  const c=DATA.slice().sort((a,b)=>b.compression_efficiency_pct-a.compression_efficiency_pct).slice(0,5);
  $("rankProcessing").innerHTML=p.map((x,i)=>`<div class="rank"><span>${i+1}. ${x.state}</span><b>${pct(x.processing_efficiency_pct)}</b></div>`).join("");
  $("rankCompression").innerHTML=c.map((x,i)=>`<div class="rank"><span>${i+1}. ${x.state}</span><b>${pct(x.compression_efficiency_pct)}</b></div>`).join("");
}
function renderTable(){
  $("tableBody").innerHTML=DATA.map(x=>`<tr><td>${x.state}</td><td>${x.waste_generated_tpd.toLocaleString()}</td><td>${x.waste_collected_tpd.toLocaleString()}</td><td>${x.waste_processed_tpd.toLocaleString()}</td><td>${pct(x.collection_efficiency_pct)}</td><td>${pct(x.processing_efficiency_pct)}</td><td>${pct(x.compression_efficiency_pct)}*</td></tr>`).join("");
}
function analyzeState(){
  const state=$("stateSelect").value;
  if(!state)return;
  const r=DATA.find(x=>x.state===state);
  $("stateResult").innerHTML=`<div class="cards">
  <div class="mini"><small>GENERATED</small><br><b>${r.waste_generated_tpd.toLocaleString()}</b> TPD</div>
  <div class="mini"><small>COLLECTION</small><br><b>${pct(r.collection_efficiency_pct)}</b></div>
  <div class="mini"><small>PROCESSING</small><br><b>${pct(r.processing_efficiency_pct)}</b></div>
  <div class="mini"><small>COMPRESSION*</small><br><b>${pct(r.compression_efficiency_pct)}</b></div>
  <div class="mini"><small>MODEL TIME*</small><br><b>${r.simulated_processing_time_s}s</b></div></div>`;
}
function runLab(){
  const p={initial_volume:+$("initial").value,final_volume:+$("final").value,mass:+$("mass").value,processing_time:+$("time").value,syringe_diameter_mm:+$("sd").value,output_diameter_mm:+$("od").value,input_force_n:+$("force").value};
  if(Object.values(p).some(v=>!isFinite(v)||v<=0)||p.final_volume>p.initial_volume){$("labResult").innerHTML="<b>Please enter valid positive values; final volume cannot exceed initial volume.</b>";return;}
  const ai=Math.PI*(p.syringe_diameter_mm/2000)**2, ao=Math.PI*(p.output_diameter_mm/2000)**2;
  const pressure=p.input_force_n/ai, output=pressure*ao, compression=(p.initial_volume-p.final_volume)/p.initial_volume*100, throughput=p.mass/p.processing_time;
  $("labResult").innerHTML=`<div class="big">${pct(compression)}</div><div>Compression efficiency</div><hr>
  <div><b>${throughput.toFixed(2)} g/s</b> throughput</div>
  <div><b>${(pressure/1000).toFixed(2)} kPa</b> input pressure</div>
  <div><b>${output.toFixed(2)} N</b> ideal output force</div>
  <div><b>${(ao/ai).toFixed(2)}×</b> theoretical force multiplication</div>`;
}
function loadAll(){
  renderKpis();renderRanks();renderTable();
  const top=DATA.slice().sort((a,b)=>b.waste_generated_tpd-a.waste_generated_tpd).slice(0,10);
  drawBar($("wasteChart"),top,"waste_generated_tpd","state");
  const eff=DATA.slice().sort((a,b)=>b.collection_efficiency_pct-a.collection_efficiency_pct).slice(0,10);
  drawBar($("effChart"),eff,"collection_efficiency_pct","state");
  $("stateSelect").innerHTML='<option value="">Select a state…</option>'+DATA.map(x=>`<option>${x.state}</option>`).join("");
}
getData().then(loadAll);
