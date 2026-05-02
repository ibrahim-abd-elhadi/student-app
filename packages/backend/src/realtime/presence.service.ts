import { Injectable } from "@nestjs/common";

@Injectable()
export class PresenceService {
private devices = new Map<string, any>();

addDevice(id: string, data: any) {
this.devices.set(id, data);
}

updateLastSeen(id: string) {
const device = this.devices.get(id);
if (device) {
device.lastSeen = Date.now();
}
}

removeDevice(id: string) {
this.devices.delete(id);
}

getActiveDevices() {
return Array.from(this.devices.values());
}
}
