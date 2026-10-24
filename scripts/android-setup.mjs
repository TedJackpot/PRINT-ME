import {copyFile,readFile,writeFile} from 'node:fs/promises';
const root='android/app/src/main';
await copyFile('native/android/PrintMeUsbPlugin.java',`${root}/java/fr/printme/app/PrintMeUsbPlugin.java`);
await copyFile('native/android/PrintMeBluetoothPlugin.java',`${root}/java/fr/printme/app/PrintMeBluetoothPlugin.java`);
await writeFile(`${root}/java/fr/printme/app/MainActivity.java`,`package fr.printme.app;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
public class MainActivity extends BridgeActivity {
  @Override public void onCreate(Bundle state) {
    registerPlugin(PrintMeUsbPlugin.class);
    registerPlugin(PrintMeBluetoothPlugin.class);
    super.onCreate(state);
  }
}
`);
const file=`${root}/AndroidManifest.xml`;
let xml=await readFile(file,'utf8');
if(!xml.includes('android.hardware.usb.host'))xml=xml.replace('<application','<uses-feature android:name="android.hardware.usb.host" android:required="false" />\n    <application');
const permissions=[
 '<uses-permission android:name="android.permission.BLUETOOTH" android:maxSdkVersion="30" />',
 '<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />',
 '<uses-feature android:name="android.hardware.bluetooth" android:required="false" />'
];
for(const permission of permissions){const name=permission.match(/android:name="([^"]+)"/)[1];if(!xml.includes('android:name="'+name+'"'))xml=xml.replace('<application',permission+'\n    <application');}
await writeFile(file,xml);
// Identité visuelle et version de la même application que sur ordinateur.
const config=JSON.parse(await readFile('package.json','utf8'));
const gradleFile='android/app/build.gradle';
let gradle=await readFile(gradleFile,'utf8');
const [major,minor,patch]=config.version.split('.').map(Number);
gradle=gradle.replace(/versionCode \d+/,`versionCode ${major*10000+minor*100+patch}`).replace(/versionName "[^"]+"/,`versionName "${config.version}"`);
await writeFile(gradleFile,gradle);
for(const density of ['mdpi','hdpi','xhdpi','xxhdpi','xxxhdpi']){
  for(const name of ['ic_launcher','ic_launcher_round','ic_launcher_foreground'])await copyFile(`assets/android-icons/${density}-${name}.png`,`${root}/res/mipmap-${density}/${name}.png`);
}
await writeFile(`${root}/res/drawable-v24/ic_launcher_foreground.xml`,'<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108"><path android:fillColor="#146956" android:pathData="M0,0h108v108h-108z"/><path android:fillColor="#FFFFFF" android:pathData="M32,28h44v52h-44z"/><path android:strokeColor="#146956" android:strokeWidth="4" android:pathData="M40,40h28M40,52h20M40,64h28"/></vector>');
