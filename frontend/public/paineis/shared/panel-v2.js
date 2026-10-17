function panelKey(key){if(key)return 'pv.panel.index.'+key;const parts=location.pathname.split('/').filter(Boolean);const leaf=parts[parts.length-1]||'default';const name=/\.html?$/i.test(leaf)?(parts[parts.length-2]||leaf):leaf;return 'pv.panel.index.'+name}
function pickPanelIndex(length,key){if(!length)return 0;try{const k=panelKey(key);const prev=Number(sessionStorage.getItem(k));const next=Number.isFinite(prev)?(prev+1)%length:Math.floor(Math.random()*length);sessionStorage.setItem(k,String(next));return next}catch(e){return Math.floor(Math.random()*length)}}
function pickPanelItem(items,key){if(!Array.isArray(items)||!items.length)return null;return items[pickPanelIndex(items.length,key)]||items[0]}
function rotateItems(items,render){if(!Array.isArray(items)||!items.length)return;const index=pickPanelIndex(items.length);render(items[index],index)}
function showLoader(ms=950){const el=document.querySelector('.boot');if(!el)return;setTimeout(()=>el.classList.add('hide'),ms)}
function setProgress(id,index,total){const el=document.getElementById(id);if(el)el.style.width=((index+1)/Math.max(total,1)*100)+'%'}
