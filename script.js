let vetrine = JSON.parse(localStorage.getItem("vetrine")) || [];

function addVetrina(){
 const nome = document.getElementById("nome").value;
 const desc = document.getElementById("desc").value;
 const files = document.getElementById("files").files;

 if(!nome){ alert("Nome vetrina obbligatorio"); return; }

 const arr=[];
 let pending = files.length;

 if(pending===0){
  save(nome,desc,arr);
  return;
 }

 [...files].forEach(f=>{
  const fr=new FileReader();
  fr.onload=e=>{
   arr.push({
    name:f.name,
    type:f.type,
    data:e.target.result,
    date:Date.now()
   });
   pending--;
   if(pending===0) save(nome,desc,arr);
  };
  fr.readAsDataURL(f);
 });
}

function save(nome,desc,files){
 vetrine.push({nome,desc,files});
 localStorage.setItem("vetrine",JSON.stringify(vetrine));
 alert("Vetrina salvata");
 location.reload();
}
