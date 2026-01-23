
// Abstraction for Secure Storage
// In a real Capacitor project, you would install 'capacitor-secure-storage-plugin'
// Since we are running in a web/hybrid context, we simulate the plugin interface or use it if available.

export const SecureStorage = {
  get: async (key: string): Promise<string | null> => {
    try {
      // Check if running in Capacitor Native
      // @ts-ignore
      if (window.Capacitor && window.Capacitor.isNative) {
         // Placeholder for actual plugin call
         // const { value } = await SecureStoragePlugin.get({ key });
         // return value;
         
         // Using localStorage for now as the plugin isn't strictly available in this web preview environment
         return localStorage.getItem(key);
      }
      return localStorage.getItem(key);
    } catch (e) {
      console.error("SecureStorage Get Error", e);
      return null;
    }
  },

  set: async (key: string, value: string): Promise<void> => {
    try {
      // @ts-ignore
      if (window.Capacitor && window.Capacitor.isNative) {
         // await SecureStoragePlugin.set({ key, value });
         localStorage.setItem(key, value);
         return;
      }
      localStorage.setItem(key, value);
    } catch (e) {
      console.error("SecureStorage Set Error", e);
    }
  },

  remove: async (key: string): Promise<void> => {
    try {
       // @ts-ignore
      if (window.Capacitor && window.Capacitor.isNative) {
         // await SecureStoragePlugin.remove({ key });
         localStorage.removeItem(key);
         return;
      }
      localStorage.removeItem(key);
    } catch (e) {
      console.error("SecureStorage Remove Error", e);
    }
  }
};
