let vetrine = JSON.parse(localStorage.getItem("vetrine")) || [];

function saveVetrina(nome,desc,files){
 vetrine.push({nome,desc,files});
 localStorage.setItem("vetrine",JSON.stringify(vetrine));
 location.reload();
}

function deleteVetrina(i){
 if(confirm("Confermi?")){
  vetrine.splice(i,1);
  localStorage.setItem("vetrine",JSON.stringify(vetrine));
  location.reload();
 }
}

function deleteFile(vi,fi){
 vetrine[vi].files.splice(fi,1);
 localStorage.setItem("vetrine",JSON.stringify(vetrine));
 location.reload();
}

function addVetrina(){
 const nome=document.getElementById("nome").value;
 const desc=document.getElementById("desc").value;
 const files=document.getElementById("files").files;
 let arr=[],p=files.length;

 if(!p) return saveVetrina(nome,desc,arr);

 [...files].forEach(f=>{
  const r=new FileReader();
  r.onload=e=>{
   arr.push({name:f.name,type:f.type,data:e.target.result});
   if(--p===0) saveVetrina(nome,desc,arr);
  };
  r.readAsDataURL(f);
 });
}
