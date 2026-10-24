package fr.printme.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothSocket;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.provider.Settings;
import android.util.Base64;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.IOException;
import java.io.OutputStream;
import java.util.UUID;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

/** Transport Bluetooth Classic RFCOMM/SPP. BLE et protocoles propriétaires non devinés. */
// All paired-device operations are gated by permitted() before reaching the worker.
@SuppressLint("MissingPermission")
@CapacitorPlugin(name = "PrintMeBluetooth", permissions = {
    @Permission(alias = "bluetooth", strings = {Manifest.permission.BLUETOOTH_CONNECT})
})
public class PrintMeBluetoothPlugin extends Plugin {
    private static final UUID SPP = UUID.fromString("00001101-0000-1000-8000-00805f9b34fb");
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final ScheduledExecutorService timer = Executors.newSingleThreadScheduledExecutor();
    private final AtomicInteger generation = new AtomicInteger();
    private volatile BluetoothSocket socket;
    private volatile boolean connecting;

    private boolean permitted() {
        return Build.VERSION.SDK_INT < 31 || getPermissionState("bluetooth") == PermissionState.GRANTED;
    }
    private BluetoothAdapter adapter() throws IOException {
        BluetoothManager manager = (BluetoothManager)getContext().getSystemService(Context.BLUETOOTH_SERVICE);
        BluetoothAdapter adapter = manager == null ? null : manager.getAdapter();
        if (adapter == null) throw new IOException("Ce téléphone ne possède pas d’adaptateur Bluetooth disponible.");
        if (!adapter.isEnabled()) throw new IOException("Activez le Bluetooth du téléphone, puis revenez dans PRINT ME.");
        return adapter;
    }
    private static void closeQuietly(BluetoothSocket value) {
        if (value != null) try { value.close(); } catch (IOException ignored) {}
    }
    private void closeSession() {
        generation.incrementAndGet();
        BluetoothSocket old = socket; socket = null; closeQuietly(old);
    }
    private void emitDisconnected() {
        JSObject event = new JSObject(); event.put("connected", false);
        notifyListeners("disconnected", event);
    }
    @PluginMethod public void openSettings(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try { getActivity().startActivity(new Intent(Settings.ACTION_BLUETOOTH_SETTINGS)); call.resolve(); }
            catch (Exception error) { call.reject("Ouvrez les réglages Bluetooth du téléphone."); }
        });
    }
    @PluginMethod public void list(PluginCall call) {
        if (!permitted()) { requestPermissionForAlias("bluetooth", call, "listPermission"); return; }
        listPaired(call);
    }
    @PermissionCallback private void listPermission(PluginCall call) {
        if (permitted()) listPaired(call);
        else call.reject("Autorisez les appareils à proximité pour afficher les imprimantes appairées.");
    }
    private void listPaired(PluginCall call) {
        try {
            JSArray devices = new JSArray();
            for (BluetoothDevice device : adapter().getBondedDevices()) {
                JSObject item = new JSObject();
                item.put("id", device.getAddress());
                item.put("name", device.getName() == null ? "Appareil Bluetooth" : device.getName());
                item.put("classic", device.getType() != BluetoothDevice.DEVICE_TYPE_LE);
                devices.put(item);
            }
            JSObject result = new JSObject(); result.put("devices", devices); call.resolve(result);
        } catch (Exception error) { call.reject(error.getMessage()); }
    }
    @PluginMethod public void connect(PluginCall call) {
        if (!permitted()) { requestPermissionForAlias("bluetooth", call, "connectPermission"); return; }
        connectPaired(call);
    }
    @PermissionCallback private void connectPermission(PluginCall call) {
        if (permitted()) connectPaired(call);
        else call.reject("Autorisation Bluetooth refusée. Autorisez les appareils à proximité dans les paramètres de PRINT ME.");
    }
    private synchronized void connectPaired(PluginCall call) {
        if (connecting) { call.reject("Une connexion Bluetooth est déjà en cours."); return; }
        final BluetoothDevice target;
        try {
            String address = call.getString("id", "");
            if (!BluetoothAdapter.checkBluetoothAddress(address)) throw new IOException("Sélectionnez l’imprimante dans la liste.");
            BluetoothDevice found = null;
            for (BluetoothDevice device : adapter().getBondedDevices()) if (address.equals(device.getAddress())) found = device;
            if (found == null) throw new IOException("Appairez d’abord cette imprimante dans les réglages Bluetooth Android.");
            if (found.getType() == BluetoothDevice.DEVICE_TYPE_LE) throw new IOException("Cet appareil annonce uniquement Bluetooth LE. Le mode classique SPP ne convient pas.");
            target = found;
        } catch (Exception error) { call.reject(error.getMessage()); return; }
        closeSession(); final int attempt = generation.get(); connecting = true;
        worker.execute(() -> {
            BluetoothSocket candidate = null; ScheduledFuture<?> timeout = null;
            try {
                candidate = target.createRfcommSocketToServiceRecord(SPP);
                final BluetoothSocket pending = candidate;
                synchronized (this) {
                    if (generation.get() != attempt) throw new IOException("Connexion annulée.");
                    socket = candidate;
                }
                timeout = timer.schedule(() -> closeQuietly(pending), 15, TimeUnit.SECONDS);
                candidate.connect();
                if (generation.get() != attempt || !candidate.isConnected()) throw new IOException("Connexion Bluetooth interrompue.");
                JSObject result = new JSObject(); result.put("name", target.getName()); result.put("id", target.getAddress()); result.put("transport", "SPP");
                call.resolve(result);
            } catch (Exception error) {
                closeQuietly(candidate);
                if (socket == candidate) socket = null;
                call.reject("Connexion Bluetooth classique impossible. Vérifiez que l’imprimante est allumée, appairée, proche et libre dans les autres applications. Son service SPP reste à confirmer. " + error.getMessage());
            } finally { if (timeout != null) timeout.cancel(false); connecting = false; }
        });
    }
    @PluginMethod public void write(PluginCall call) {
        final byte[] bytes;
        try {
            String encoded = call.getString("data", "");
            if (encoded.length() > 16 * 1024 * 1024) throw new IOException("Document trop volumineux.");
            bytes = Base64.decode(encoded, Base64.NO_WRAP);
            if (bytes.length == 0 || bytes.length > 12 * 1024 * 1024) throw new IOException("Document vide ou trop volumineux.");
        } catch (Exception error) { call.reject("Données d’impression invalides : " + error.getMessage()); return; }
        final BluetoothSocket current = socket;
        if (current == null || !current.isConnected()) { call.reject("Connectez l’imprimante Bluetooth avant d’imprimer."); return; }
        worker.execute(() -> {
            ScheduledFuture<?> timeout = timer.schedule(() -> closeQuietly(current), 60, TimeUnit.SECONDS);
            try {
                if (socket != current) throw new IOException("Connexion remplacée ou fermée.");
                OutputStream output = current.getOutputStream();
                for (int offset = 0; offset < bytes.length; offset += 1024) output.write(bytes, offset, Math.min(1024, bytes.length - offset));
                output.flush(); call.resolve();
            } catch (Exception error) {
                closeQuietly(current); if (socket == current) socket = null;
                emitDisconnected(); call.reject("Envoi Bluetooth interrompu. Vérifiez le papier avant de relancer pour éviter une impression en double. " + error.getMessage());
            } finally { timeout.cancel(false); }
        });
    }
    @PluginMethod public void status(PluginCall call) {
        BluetoothSocket current = socket; JSObject result = new JSObject(); result.put("connected", current != null && current.isConnected()); call.resolve(result);
    }
    @PluginMethod public void disconnect(PluginCall call) { closeSession(); emitDisconnected(); call.resolve(); }
    @Override protected void handleOnDestroy() { closeSession(); worker.shutdownNow(); timer.shutdownNow(); }
}
