/* ===================== DEVICE MANAGER ===================== */
const MAX_DEVICES = 3;

function getAllowedDevices(){
  try{
    return JSON.parse(localStorage.getItem("sercuctech_admin_devices")) || [];
  }catch(e){
    return [];
  }
}

function saveAllowedDevices(list){
  localStorage.setItem("sercuctech_admin_devices", JSON.stringify(list));
}

function addAllowedDevice(deviceId){
  let devices = getAllowedDevices();

  if(devices.includes(deviceId)) return true;

  if(devices.length >= MAX_DEVICES){
    alert("Limite dispositivi raggiunto. Rimuovine uno prima.");
    return false;
  }

  devices.push(deviceId);
  saveAllowedDevices(devices);
  return true;
}

function removeAllowedDevice(deviceId){
  let devices = getAllowedDevices().filter(d => d !== deviceId);
  saveAllowedDevices(devices);
}
