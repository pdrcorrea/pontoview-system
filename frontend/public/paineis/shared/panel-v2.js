function rotateItems(items, render, ms=9000){let i=0;render(items[i],i);if(items.length<2)return;setInterval(()=>{i=(i+1)%items.length;render(items[i],i)},ms)}
function showLoader(ms=950){const el=document.querySelector('.boot');if(!el)return;setTimeout(()=>el.classList.add('hide'),ms)}
function setProgress(id,index,total){const el=document.getElementById(id);if(el)el.style.width=((index+1)/total*100)+'%'}
