// 🗺️ إنشاء الخريطة
const map = L.map('map').setView([31.5, 30.9], 10);

const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{ maxZoom:19, attribution:'© OpenStreetMap' }).addTo(map);
const sat = L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',{ maxZoom:20, subdomains:['mt0','mt1','mt2','mt3'] });

L.control.layers({ "خريطة الشوارع": osm, "القمر الصناعي": sat }).addTo(map);

// دائرة المنطقة
const borollosCircle = L.circle([31.5,30.9], { radius:10000, color:"#007bff", fillColor:"#007bff", fillOpacity:0.2, weight:2 }).addTo(map).bindPopup("<strong>منطقة الدراسة:</strong> بحيرة البرلس");

let uploadedLayer, chart, allPoints = [];

// دالة التحقق من داخل الدائرة
function isInsideCircle(lat, lon){
  const center = borollosCircle.getLatLng();
  return map.distance([lat,lon],center) <= borollosCircle.getRadius();
}

// استقبال الملفات
document.getElementById("fileInput").addEventListener("change", (e)=>{
  const file = e.target.files[0]; if(!file) return;
  const reader = new FileReader();

  if(file.name.endsWith(".csv")){
    reader.onload = (event)=>{
      const text = event.target.result;
      const rows = text.split("\n").map(r=>r.trim()).filter(r=>r);
      const headers = rows[0].split(",");
      const latIndex = headers.findIndex(h=>/lat/i.test(h));
      const lonIndex = headers.findIndex(h=>/lon|lng|long/i.test(h));
      const typeIndex = headers.findIndex(h=>/type/i.test(h));

      if(latIndex===-1||lonIndex===-1){ alert("❌ الملف لا يحتوي على أعمدة (lat, lon)"); return; }

      const points = rows.slice(1).map(row=>{
        const cols = row.split(",");
        return { lat: parseFloat(cols[latIndex]), lon: parseFloat(cols[lonIndex]), type: typeIndex!==-1?cols[typeIndex].trim():"غير محدد", props: Object.fromEntries(headers.map((h,i)=>[h,cols[i]])) };
      }).filter(p=>isInsideCircle(p.lat,p.lon));

      allPoints = points;
      drawPoints(points);
      updateDashboard(points);
      fillTable(points);
    };
    reader.readAsText(file);
  } else { alert("❌ صيغة غير مدعومة. استخدم CSV فقط."); }
});

// رسم النقاط
function drawPoints(points){
  if(uploadedLayer) map.removeLayer(uploadedLayer);
  uploadedLayer = L.layerGroup(points.map(p=>{
    let color="#9e9e9e";
    const typeLower = p.type.toLowerCase();
    if(typeLower.includes("صناعة")) color="#e74c3c";
    else if(typeLower.includes("زراعة")) color="#2ecc71";
    else if(typeLower.includes("سكنية")) color="#3498db";
    else if(typeLower.includes("صيد")) color="#00bcd4";

    return L.circleMarker([p.lat,p.lon],{ radius:6, fillColor:color, color:"#fff", weight:1, fillOpacity:0.9 }).bindPopup(Object.entries(p.props).map(([k,v])=>`<strong>${k}</strong>: ${v}`).join("<br>"));
  })).addTo(map);
  map.fitBounds(borollosCircle.getBounds());
}

// ✅ تحديث الداشبورد
function updateDashboard(points){
  const typeCounts={};
  points.forEach(p=>{ const type=p.type||"غير محدد"; typeCounts[type]=(typeCounts[type]||0)+1; });
  const totalPoints = points.length;

  let html = `<h3 style="margin-bottom: 10px;">📊 تحليل النقاط</h3>
              <p style="font-weight:bold;color:#333;">إجمالي النقاط: <span style="color:#007bff;">${totalPoints}</span></p>
              <canvas id="typeChart" width="280" height="280" style="margin-bottom:15px;"></canvas>
              <ul style="list-style:none;padding:0;">`;
  for(const [type,count] of Object.entries(typeCounts)){
    const percent = ((count/totalPoints)*100).toFixed(1);
    let color="#9e9e9e"; const t=type.toLowerCase();
    if(t.includes("صناعة")) color="#e74c3c";
    else if(t.includes("زراعة")) color="#2ecc71";
    else if(t.includes("سكنية")) color="#3498db";
    else if(t.includes("صيد")) color="#00bcd4";
    html += `<li style="margin-bottom:6px;"><span style="display:inline-block;width:12px;height:12px;background:${color};margin-right:6px;border-radius:50%;"></span><strong>${type}:</strong> ${count} نقطة (${percent}%)</li>`;
  }
  html+="</ul>"; document.getElementById("dashboard").innerHTML=html;

  const ctx=document.getElementById('typeChart').getContext('2d');
  const colors = Object.keys(typeCounts).map(type=>{
    const t=type.toLowerCase();
    if(t.includes("صناعة")) return "#e74c3c";
    if(t.includes("زراعة")) return "#2ecc71";
    if(t.includes("سكنية")) return "#3498db";
    if(t.includes("صيد")) return "#00bcd4";
    return "#9e9e9e";
  });
  if(chart) chart.destroy();
  chart = new Chart(ctx,{ type:'pie', data:{ labels:Object.keys(typeCounts), datasets:[{ data:Object.values(typeCounts), backgroundColor:colors, borderColor:"#fff", borderWidth:2 }]}, options:{ responsive:false, plugins:{ legend:{ position:'bottom' }, title:{ display:true, text:"📈 توزيع النقاط حسب النوع" }}}});
}

// 📝 جدول النقاط
function fillTable(points){
  const tbody=document.getElementById("tableBody");
  tbody.innerHTML="";
  points.forEach(p=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`<td>${p.type}</td><td>${p.lat}</td><td>${p.lon}</td><td>${p.props.notes||""}</td>`;
    tbody.appendChild(tr);
  });
}

// 🔹 فلترة النقاط حسب النوع
document.querySelectorAll("#filter input[type=checkbox]").forEach(cb=>{
  cb.addEventListener("change", ()=>{
    const checked = Array.from(document.querySelectorAll("#filter input:checked")).map(c=>c.value);
    const filtered = allPoints.filter(p=>checked.some(val=>p.type.includes(val)));
    drawPoints(filtered); updateDashboard(filtered); fillTable(filtered);
  });
});

// 🔹 سلايدر الفريق
function initProductSlider(){
  let currentSlide=0;
  const slides=document.querySelectorAll(".product-slide");
  function showSlide(index){ slides.forEach((s,i)=>{ s.classList.remove("active"); if(i===index) s.classList.add("active"); }); }
  function nextSlide(){ currentSlide=(currentSlide+1)%slides.length; showSlide(currentSlide); }
  showSlide(currentSlide); setInterval(nextSlide,3000);
}
document.addEventListener("DOMContentLoaded", initProductSlider);



// 🔹 سلايدر الحياة البرية
function initWildlifeSlider(){
  let currentSlide=0;
  const slides=document.querySelectorAll(".wildlife-slide");
  
  function showSlide(index){
    slides.forEach((s,i)=>{
      s.classList.remove("active");
      if(i===index) s.classList.add("active");
    });
  }

  function nextSlide(){
    currentSlide=(currentSlide+1)%slides.length;
    showSlide(currentSlide);
  }

  showSlide(currentSlide);
  setInterval(nextSlide,3000);
}

document.addEventListener("DOMContentLoaded", initWildlifeSlider);


// ظظظظظظظظظظظظظظظظظظظظظظظظظ
let regionChart;

function showRegionActivity(points) {
  const sampleSize = Math.max(1, Math.floor(points.length * 0.1));
  const sample = points.slice(0, sampleSize);

  const regions = ["شمال", "جنوب", "شرق", "غرب"];
  const types = ["زراعة", "صيد", "سكنية", "صناعة"];
  const counts = {};

  types.forEach(type => {
    counts[type] = { شمال: 0, جنوب: 0, شرق: 0, غرب: 0 };
  });

  sample.forEach(p => {
    if (counts[p.type] && regions.includes(p.area)) {
      counts[p.type][p.area]++;
    }
  });

  // استخراج المنطقة الأعلى في كل نشاط
  // const summaryDiv = document.getElementById('region-summary-text');
  // summaryDiv.innerHTML = '';

  // const bestRegions = [];
  // types.forEach(type => {
  //   let maxRegion = "غير محدد";
  //   let maxValue = 0;
  //   for (const region in counts[type]) {
  //     if (counts[type][region] > maxValue) {
  //       maxRegion = region;
  //       maxValue = counts[type][region];
  //     }
  //   }
  //   bestRegions.push({ type, region: maxRegion, value: maxValue });
  // });

  // bestRegions.forEach(item => {
  //   const icon = item.type === "زراعة" ? "🌾" :
  //                item.type === "صيد" ? "🎣" :
  //                item.type === "سكنية" ? "🏠" : "🏭";
  //   summaryDiv.innerHTML += `<p>${icon} ${item.type}: النشاط الأكبر في <strong>${item.region}</strong></p>`;
  // });

  // إعداد المخطط
  
  const ctx = document.getElementById('regionChart').getContext('2d');
  const labels = bestRegions.map(r => r.type);
  const data = bestRegions.map(r => r.value);

  if (regionChart) regionChart.destroy();

  regionChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'أكثر منطقة نشاطًا (عدد النقاط)',
        data: data,
        backgroundColor: ['#4caf50','#2196f3','#ff9800','#9c27b0']
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        title: { display: true, text: 'توزيع النشاط في أكثر المناطق نشاطًا' }
      },
      scales: { y: { beginAtZero: true } }
    }
  });
}

// بيانات تجريبية للعرض الأولي
// const demoPoints = [
//   { type: 'زراعة', area: 'جنوب' },
//   { type: 'زراعة', area: 'جنوب' },
//   { type: 'زراعة', area: 'غرب' },
//   { type: 'صيد', area: 'شمال' },
//   { type: 'صيد', area: 'شمال' },
//   { type: 'صيد', area: 'شرق' },
//   { type: 'سكنية', area: 'غرب' },
//   { type: 'سكنية', area: 'غرب' },
//   { type: 'صناعة', area: 'شرق' },
//   { type: 'صناعة', area: 'شرق' },
// 
// showRegionActivity(demoPoints);

// يتحدث تلقائيًا عند رفع ملف
document.getElementById('fileInput').addEventListener('change', function(e) {
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = function(event) {
    let points = [];
    if(file.name.endsWith('.csv')) {
      const lines = event.target.result.split('\n');
      lines.slice(1).forEach(line => {
        const [type,, ,area] = line.split(',');
        if(type && area) points.push({ type: type.trim(), area: area.trim() });
      });
    } else {
      const geojson = JSON.parse(event.target.result);
      geojson.features.forEach(f => {
        points.push({ type: f.properties.type, area: f.properties.area });
      });
    }
    showRegionActivity(points);
  };
  reader.readAsText(file);
});
// ظظظظظظظظظظظظظظظظظظظظظظظظظظظظظظظظظظظظظظ


// إنشاء خريطة المستخدم بعد التأكد أن DOM جاهز
document.addEventListener("DOMContentLoaded", () => {
  const userMap = L.map('userMap').setView([20,0], 2);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  }).addTo(userMap);

  let userLayer, userChart;

  document.getElementById('userFile').addEventListener('change', function(e){
    const file = e.target.files[0];
    if(!file) return;

    const reader = new FileReader();
    reader.onload = function(event){
      let points = [];

      if(file.name.endsWith('.csv')){
        const lines = event.target.result.split('\n').map(l=>l.trim()).filter(l=>l);
        const headers = lines[0].split(',');
        const latIndex = headers.findIndex(h=>/lat/i.test(h));
        const lonIndex = headers.findIndex(h=>/lon|lng|long/i.test(h));
        const typeIndex = headers.findIndex(h=>/type/i.test(h));

        if(latIndex===-1 || lonIndex===-1){
          alert("❌ الملف لا يحتوي على أعمدة (lat, lon)");
          return;
        }

        points = lines.slice(1).map(l=>{
          const cols = l.split(',');
          return {
            lat: parseFloat(cols[latIndex]),
            lon: parseFloat(cols[lonIndex]),
            type: typeIndex!==-1 ? cols[typeIndex].trim() : "غير محدد"
          };
        });

      } else {
        const geojson = JSON.parse(event.target.result);
        points = geojson.features.map(f=>({
          lat: f.geometry.coordinates[1],
          lon: f.geometry.coordinates[0],
          type: f.properties.type || "غير محدد"
        }));
      }

      // إزالة الطبقة القديمة
      if(userLayer) userMap.removeLayer(userLayer);

      userLayer = L.layerGroup(points.map(p=>{
        let color = "#9e9e9e";
        const t = p.type.toLowerCase();
        if(t.includes("زراعة")) color="#2ecc71";
        else if(t.includes("صيد")) color="#00bcd4";
        else if(t.includes("سكنية")) color="#ff9800";
        else if(t.includes("صناعة")) color="#e74c3c";

        return L.circleMarker([p.lat,p.lon], {
          radius: 6,
          fillColor: color,
          color: "#fff",
          weight: 1,
          fillOpacity: 0.9
        }).bindPopup(`<strong>النوع:</strong> ${p.type}`);
      })).addTo(userMap);

      // ضبط الإطار على جميع النقاط أو عرض العالم
      if(points.length > 0){
        userMap.fitBounds(userLayer.getBounds());
      } else {
        userMap.setView([20,0],2);
      }

      // تحليل البيانات ورسم المخطط
      const typeCounts = {};
      points.forEach(p=>{ typeCounts[p.type] = (typeCounts[p.type]||0)+1; });

      const ctx = document.getElementById('userChart').getContext('2d');
      if(userChart) userChart.destroy();
      userChart = new Chart(ctx,{
        type: 'pie',
        data: {
          labels: Object.keys(typeCounts),
          datasets: [{
            data: Object.values(typeCounts),
            backgroundColor: ['#2ecc71','#00bcd4','#ff9800','#e74c3c']
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'bottom' },
            title: { display: true, text: '📈 توزيع الأنشطة في الملف المرفوع' }
          }
        }
      });
    };
    reader.readAsText(file);
  });
});


// ظظظظظظظظظظظظظظظظظظظ
