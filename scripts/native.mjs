import { Capacitor, registerPlugin } from '@capacitor/core';
import { Printer } from '@capgo/capacitor-printer';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
if (Capacitor.isNativePlatform()) {
  window.printmeNative = {
    platform: Capacitor.getPlatform(),
    bluetooth: Capacitor.getPlatform()==='android'?registerPlugin('PrintMeBluetooth'):null,
    usb: Capacitor.getPlatform()==='android'?registerPlugin('PrintMeUsb'):null,
    print: (html) => Printer.printHtml({ name: 'PRINT ME — Étiquettes', html }),
    async save(name, blob) {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader(); reader.onerror = reject;
        reader.onload = () => resolve(reader.result.split(',')[1]); reader.readAsDataURL(blob);
      });
      const file = await Filesystem.writeFile({path: name.replace(/[^a-zA-Z0-9._-]/g, '_'), data: base64, directory: Directory.Cache});
      await Share.share({title: 'PRINT ME', files: [file.uri]});
    }
  };
}
