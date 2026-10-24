package fr.printme.app;

import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.hardware.usb.*;
import android.os.Build;
import android.util.Base64;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "PrintMeUsb")
public class PrintMeUsbPlugin extends Plugin {
    private final ExecutorService io=Executors.newSingleThreadExecutor();
    private volatile UsbDeviceConnection connection;
    private UsbInterface usbInterface;
    private UsbEndpoint endpoint;
    private BroadcastReceiver receiver;
    private PluginCall pending;
    private UsbManager manager() { return (UsbManager)getContext().getSystemService(Context.USB_SERVICE); }
    private UsbEndpoint output(UsbInterface iface) {
        for (int i=0; i<iface.getEndpointCount(); i++) {
            UsbEndpoint ep=iface.getEndpoint(i);
            if(ep.getDirection()==UsbConstants.USB_DIR_OUT && ep.getType()==UsbConstants.USB_ENDPOINT_XFER_BULK) return ep;
        }
        return null;
    }
    @PluginMethod public void list(PluginCall call) {
        JSArray devices=new JSArray();
        for(UsbDevice device:manager().getDeviceList().values()) {
            for(int i=0;i<device.getInterfaceCount();i++) if(output(device.getInterface(i))!=null) {
                JSObject info=new JSObject();info.put("id",device.getDeviceName());
                info.put("name",device.getProductName()!=null?device.getProductName():"USB "+device.getVendorId()+":"+device.getProductId());
                devices.put(info);break;
            }
        }
        JSObject result=new JSObject();result.put("devices",devices);call.resolve(result);
    }
    private void closeUsb() {
        if(connection!=null){connection.releaseInterface(usbInterface);connection.close();}
        connection=null;endpoint=null;usbInterface=null;
    }
    private void open(UsbDevice device,PluginCall call) {
        closeUsb();
        for(int i=0;i<device.getInterfaceCount();i++) {
            UsbInterface iface=device.getInterface(i);UsbEndpoint ep=output(iface);
            if(ep==null)continue;
            UsbDeviceConnection conn=manager().openDevice(device);
            if(conn!=null && conn.claimInterface(iface,true)) {
                connection=conn;usbInterface=iface;endpoint=ep;
                JSObject result=new JSObject();result.put("name",device.getProductName()!=null?device.getProductName():device.getDeviceName());call.resolve(result);return;
            }
            if(conn!=null)conn.close();
        }
        call.reject("Impossible d’ouvrir la sortie USB. Vérifiez le câble OTG et l’imprimante.");
    }
    @PluginMethod public void connect(PluginCall call) {
        if(pending!=null){call.reject("Une demande USB est déjà en cours");return;}
        UsbDevice device=manager().getDeviceList().get(call.getString("id",""));
        if(device==null){call.reject("Imprimante USB débranchée");return;}
        if(manager().hasPermission(device)){open(device,call);return;}
        pending=call;
        String action=getContext().getPackageName()+".USB_PERMISSION";
        receiver=new BroadcastReceiver(){@Override public void onReceive(Context context,Intent intent){
            if(!action.equals(intent.getAction()))return;
            context.unregisterReceiver(this);receiver=null;pending=null;
            if(intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED,false))open(device,call);
            else call.reject("Autorisation USB refusée");
        }};
        if(Build.VERSION.SDK_INT>=33)getContext().registerReceiver(receiver,new IntentFilter(action),Context.RECEIVER_NOT_EXPORTED);
        else getContext().registerReceiver(receiver,new IntentFilter(action));
        PendingIntent permission=PendingIntent.getBroadcast(getContext(),0,new Intent(action).setPackage(getContext().getPackageName()),PendingIntent.FLAG_IMMUTABLE);
        manager().requestPermission(device,permission);
    }
    @PluginMethod public void write(PluginCall call) {
        io.execute(() -> writeOnWorker(call));
    }
    private void writeOnWorker(PluginCall call) {
        if(connection==null||endpoint==null){call.reject("Connectez l’imprimante USB");return;}
        try {
            byte[] bytes=Base64.decode(call.getString("data",""),Base64.DEFAULT);
            if(bytes.length==0||bytes.length>12*1024*1024)throw new Exception("Taille d’envoi invalide");
            int offset=0;
            while(offset<bytes.length){
                int sent=connection.bulkTransfer(endpoint,bytes,offset,Math.min(16384,bytes.length-offset),5000);
                if(sent<=0)throw new Exception("Envoi USB interrompu après "+offset+" octets");
                offset+=sent;
            }
            call.resolve();
        }catch(Exception error){closeUsb();call.reject(error.getMessage());}
    }
    @PluginMethod public void disconnect(PluginCall call){closeUsb();call.resolve();}
    @Override protected void handleOnDestroy(){
        io.shutdownNow();
        closeUsb();
        if(receiver!=null){getContext().unregisterReceiver(receiver);receiver=null;}
        if(pending!=null){pending.reject("Connexion interrompue");pending=null;}
    }
}
