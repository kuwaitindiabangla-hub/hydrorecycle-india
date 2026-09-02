let DATA=[];
const $=id=>document.getElementById(id);
async function getData(){DATA=await fetch('/api/data').then(r=>r.json());}
function pct(x){return Number(x).toFixed(1)+'%'}
function renderKpis(s){
$("kpis").innerHTML=[
["STATES",s.states,"analysed"],
["GENERATED",Number(s.generated_tpd).toLocaleString(),"tonnes/day"],
["PROCESSED",Number(s.processed_tpd).toLocaleString(),"tonnes/day"],
["AVG COMPRESSION",pct(s.mean_compression),"simulated"],
["PEARSON r",Number(s.corr_generation_time).toFixed(3),"generation vs model time"]
].map(x=>`<div class="kpi"><small>${x[0]}</small><div class="num">${x[1]}</div><small>${x[2]}</small></div>`).join("");
}
function drawBar(canvas,items,key1,key2){
let c=canvas,ctx=c.getContext('2d'),w=c.clientWidth||600,h=300,dpr=devicePixelRatio||1;c.width=w*dpr;c.height=h*dpr;ctx.scale(dpr,dpr);
ctx.clearRect(0,0,w,h);let max=Math.max(...items.map(x=>+x[key1])),bw=Math.max(12,(w-50)/items.length-8);
items.forEach((x,i)=>{let val=+x[key1],bh=(h-55)*val/max,xx=35+i*(bw+8),yy=h-35-bh;ctx.fillStyle="#68e0ad";ctx.fillRect(xx,yy,bw,bh);ctx.fillStyle="#8fa99f";ctx.font="10px Segoe UI";ctx.save();ctx.translate(xx+bw/2,h-10);ctx.rotate(-.65);ctx.textAlign="right";ctx.fillText(x[key2],0,0);ctx.restore()})
}
async function loadAll(){
await getData();let r=await fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({state:"ALL"})}).then(x=>x.json());
renderKpis(r.summary);
let top=DATA.slice().sort((a,b)=>b.waste_generated_tpd-a.waste_generated_tpd).slice(0,10);
drawBar($("wasteChart"),top,"waste_generated_tpd","state");
let eff=DATA.slice().sort((a,b)=>b.collection_efficiency_pct-a.collection_efficiency_pct).slice(0,10);
drawBar($("effChart"),eff,"collection_efficiency_pct","state");
$("rankProcessing").innerHTML=r.ranks.processing.map((x,i)=>`<div class="rank"><span>${i+1}. ${x.state}</span><b>${pct(x.processing_efficiency_pct)}</b></div>`).join("");
$("rankCompression").innerHTML=r.ranks.compression.map((x,i)=>`<div class="rank"><span>${i+1}. ${x.state}</span><b>${pct(x.compression_efficiency_pct)}</b></div>`).join("");
$("stateSelect").innerHTML='<option value="ALL">Select a state…</option>'+DATA.map(x=>`<option>${x.state}</option>`).join("");
$("tableBody").innerHTML=DATA.map(x=>`<tr><td>${x.state}</td><td>${x.waste_generated_tpd.toLocaleString()}</td><td>${x.waste_collected_tpd.toLocaleString()}</td><td>${x.waste_processed_tpd.toLocaleString()}</td><td>${pct(x.collection_efficiency_pct)}</td><td>${pct(x.processing_efficiency_pct)}</td><td>${pct(x.compression_efficiency_pct)}*</td></tr>`).join("");
}
async function analyzeState(){
let state=$("stateSelect").value;if(state==="ALL")return;
let r=await fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({state})}).then(x=>x.json());
$("stateResult").innerHTML=`<div class="cards">
<div class="mini"><small>GENERATED</small><br><b>${r.official.generated.toLocaleString()}</b> TPD</div>
<div class="mini"><small>COLLECTION</small><br><b>${pct(r.official.collection_efficiency)}</b></div>
<div class="mini"><small>PROCESSING</small><br><b>${pct(r.official.processing_efficiency)}</b></div>
<div class="mini"><small>COMPRESSION*</small><br><b>${pct(r.model.compression_efficiency)}</b></div>
<div class="mini"><small>MODEL TIME*</small><br><b>${r.model.processing_time}s</b></div></div>`;
}
async function runLab(){
let p={initial_volume:+$("initial").value,final_volume:+$("final").value,mass:+$("mass").value,processing_time:+$("time").value,syringe_diameter_mm:+$("sd").value,output_diameter_mm:+$("od").value,input_force_n:+$("force").value};
let r=await fetch('/api/custom',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(p)}).then(x=>x.json());
if(r.error){$("labResult").innerHTML='<b>'+r.error+'</b>';return}
$("labResult").innerHTML=`<div class="big">${pct(r.compression_efficiency)}</div><div>Compression efficiency</div><hr><div><b>${r.throughput_g_s.toFixed(2)} g/s</b> throughput</div><div><b>${(r.pressure_pa/1000).toFixed(2)} kPa</b> input pressure</div><div><b>${r.ideal_output_force_n.toFixed(2)} N</b> ideal output force</div><div><b>${r.force_ratio.toFixed(2)}×</b> theoretical force multiplication</div>`;
}
loadAll();
