/* ===================== BACKUP EXPORT ===================== */
async function exportFullBackup(){
  const backup = {
    app: "SerCucTech",
    createdAt: new Date().toISOString(),
    vetrine: [],
    links: []
  };

  const index = await loadIndexSmart();

  for(const id in index.vetrine){
    const file = index.vetrine[id].file;
    try{
      const v = await fetch(file).then(r=>r.json());
      backup.vetrine.push(v);
      backup.links.push(`vetrina.html?id=${id}`);
    }catch(e){}
  }

  const blob = new Blob(
    [JSON.stringify(backup,null,2)],
    {type:"application/json"}
  );

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `sercuctech-backup-${Date.now()}.json`;
  a.click();
}

document.getElementById("exportBackupBtn")
  ?.addEventListener("click", exportFullBackup);
