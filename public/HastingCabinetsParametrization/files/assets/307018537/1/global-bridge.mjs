import { Script } from "playcanvas";
import { LoggerService } from "./../services/logger/logger-service.mjs";
import { CameraController } from "../services/camera/camera-controller.mjs";
import { CameraPlugin } from "./adapters/camera.plugin.mjs";
import { ARExportPlugin } from "./plugins/ar-export.plugin.mjs";
import { ProductPlugin } from "./plugins/product.plugin.mjs";
import { ProductConfigPlugin } from "./plugins/product-config.plugin.mjs";
import { DrawerPlugin } from "./plugins/drawer.plugin.mjs";
import { SelectionPlugin } from "./plugins/selection.plugin.mjs";
import { DividerPlugin } from "./plugins/divider.plugin.mjs";
import { CountertopPlugin } from "./plugins/countertop.plugin.mjs";
import { ModulesPlugin } from "./plugins/modules.plugin.mjs";
import { CabinetCoverPlugin } from './plugins/cabinet-cover.plugin.mjs';
import { createLegacyLineWriteBarrier } from './plugins/legacy-line-write-barrier.mjs';
import { mountCabinetDebugPanel } from './debug/cabinet-debug-panel.mjs';
import { InteractionLogger } from "../services/logger/interaction-logger.mjs";
import { createCabinetLocalRuntime } from './plugins/cabinet-local-runtime.mjs';
import { createCabinetLocalScene } from './plugins/cabinet-local-scene.mjs';
import { createCabinetDraftDragAdapter } from '../domain/cabinet-placement/adapters/cabinet-draft-drag-adapter.mjs';
import { createCabinetDraftOverlay } from '../domain/cabinet-placement/adapters/cabinet-draft-overlay.mjs';
import { ProductRegistry_V2 } from '../domain/product/registry/product-registry-v2.mjs';
import { roomController } from '../domain/scene/room/room-offset.mjs';

/**
 * The {@link https://api.playcanvas.com/classes/Engine.Script.html | Script} class is
 * the base class for all PlayCanvas scripts. Learn more about writing scripts in the
 * {@link https://developer.playcanvas.com/user-manual/scripting/ | scripting guide}.
 */
export class GlobalBridge extends Script {
  static scriptName = "globalBridge";

  /**
   * Called when the script is about to run for the first time.
   */
  initialize() {
    LoggerService.log(this, "[GlobalBridge] Initialized");

    // Ініціалізація Camera Controller (об'єднує manual zoom і auto-framing)
    this.app.cameraController = new CameraController(this.app);
    this.app.cameraController.initialize();

    this.on('destroy', () => {
      this._cleanupCabinetRuntime();
      this._cleanupCountertopPlugin();
      this._cleanupModulesPlugin();
      this._cleanupCabinetCoverPlugin();
    });

    // Експонуємо публічне API у window.ConfiguratorAPI
    // Це єдиний контракт, який має знати Frontend розробник
    this._exposeAPI();

    // Consumers of bridge:ready must observe the complete API surface.
    this.app.fire("bridge:ready");

    // ConfigService.initialize()
  }
// test
  _exposeAPI() {
    this._cleanupCountertopPlugin();
    this._cleanupModulesPlugin();
    this._cleanupCabinetCoverPlugin();
    this._countertopPlugin = CountertopPlugin.create({
      app: this.app,
      bridge: this
    });
    this._modulesPlugin = ModulesPlugin.create({
      app: this.app,
      bridge: this
    });
    this._cabinetCoverPlugin = CabinetCoverPlugin.create({
      app: this.app,
      bridge: this
    });

    window.ConfiguratorAPI = {
      // @deprecated — прямий доступ до app. Використовуйте специфічні методи API.
      config: this.app,

      // ======================== Product CRUD (Plugin) ========================
      ...ProductPlugin.create({ app: this.app, bridge: this }),

      // ======================== Selection (Plugin) ========================
      ...SelectionPlugin.create({ app: this.app, bridge: this }),

      // ======================== Product Config (Plugin) ========================
      ...ProductConfigPlugin.create({ app: this.app, bridge: this }),

      // ======================== Dividers (Plugin) ========================
      dividers: DividerPlugin.create({ app: this.app, bridge: this }),

      // ======================== Countertop (Plugin) ========================
      countertop: this._countertopPlugin.api,
      // Drag & Drop visuals of the countertop (tint, outline, screen anchors for the UI).
      countertopOverlay: this._countertopPlugin.overlayApi,

      // ======================== Derived cabinet covers (Plugin) ========================
      cabinetCover: this._cabinetCoverPlugin.api,

      // ======================== Composition modules (Plugin) ========================
      modules: this._modulesPlugin.api,

      // ======================== Drawer (Plugin) ========================
      ...DrawerPlugin.create({ app: this.app, bridge: this }),

      // ======================== AR Export (Plugin) ========================
      ...ARExportPlugin.create({ app: this.app, bridge: this }),

      // ======================== Camera (Plugin) ========================
      camera: CameraPlugin.create({ app: this.app, bridge: this }),

      // ======================== Room (per-collection height) ========================
      // room.setCollection('urban-low-height' | 'class' | … | null), room.clearCollection(), room.getState()
      room: roomController(this.app)

    };

    // Interaction Logger — записує виклики для тестування та дебагінгу
    const logger = new InteractionLogger();
    this.app.interactionLogger = logger;

    const queuedMethods = [
      'presetProducts', 'removeAllProduct', 'setConfigBatch'
    ];

    const loggedMethods = [
      'addProduct', 'addProductByLeft', 'addProductByRight',
      'setProductByParams', 'presetProducts',
      'removeProduct', 'removeAllProduct', 'swapProducts',
      'setConfig', 'setConfigBatch'
    ];

    this._wrapMutatingMethodsWithQueue(window.ConfiguratorAPI, queuedMethods);
    logger.wrapMethods(window.ConfiguratorAPI, loggedMethods);
    const writeBarrier=this.app._legacyLineWriteBarrier ?? createLegacyLineWriteBarrier(this.app);
    this.app._legacyLineWriteBarrier=writeBarrier;
    writeBarrier.wrap(window.ConfiguratorAPI,loggedMethods);

    window.ConfiguratorAPI.logger = logger;
    if (!this._cabinetRuntimePlugin) {
      // The cabinet runtime: collection-driven. It owns a composition only while it is a
      // modular-collection one (ULH...), so Urban/Class/Mako stay legacy without any switch.
      this._cabinetRuntimePlugin = createCabinetLocalRuntime({ app: this.app,
          createScene: () => createCabinetLocalScene({app:this.app}),
          getProductConfig: type => ProductRegistry_V2.instance.getProductConfig(type),
          listProductTypes: () => ProductRegistry_V2.instance.getAllProductTypes(),
          createInput: createCabinetDraftDragAdapter,
          // Draft tint (green / red), outline and screen anchors for the UI's icons: placementOverlay.
          createOverlay: createCabinetDraftOverlay });
      this._cabinetRuntimePlugin.start().catch(error => {
        LoggerService.error(this, '[GlobalBridge] ULH runtime initialization failed', error);
      });
    }
    Object.assign(window.ConfiguratorAPI,this._cabinetRuntimePlugin.api);
    // Existing writers may edit an idle local composition, but never a live draft. The runtime
    // blocks only while it owns a busy modular composition; legacy compositions pass through.
    if (this._cabinetRuntimePlugin.assertWritable || this._cabinetRuntimePlugin.assertIdle) {
      const check = () => {
        const plugin = this._cabinetRuntimePlugin;
        (plugin?.assertWritable ?? plugin?.assertIdle)?.();
      };
      // Only composition writers: UI/presentation setters (setVisibleButtons, setDrawerAnimationConfig,
      // drag toggles...) never block. add*/presetProducts are routed by compatibility.prepare and the
      // SceneManager writer guard. All of these return promises (logged methods are async after
      // InteractionLogger wrapping), so a block is a rejection, never a synchronous throw.
      const writers = {
        '': ['setProductByParams', 'removeProduct', 'removeAllProduct', 'swapProducts', 'setConfig', 'setConfigBatch'],
        modules: ['setOffset', 'resetOffset'],
        countertop: ['setOffset', 'resetOffset', 'setSize', 'resizeFrom'],
        cabinetCover: ['configure']
      };
      const guard = (target, names) => {
        for (const name of names) {
          if (typeof target[name] !== 'function') continue;
          const original = target[name];
          target[name] = (...args) => {
            try { check(); } catch (error) { return Promise.reject(error); }
            return original(...args);
          };
        }
        return target;
      };
      for (const [name, names] of Object.entries(writers)) {
        if (!name) guard(window.ConfiguratorAPI, names);
        else window.ConfiguratorAPI[name] = guard({...window.ConfiguratorAPI[name]}, names);
      }
    }
    this._cabinetDebugPanel?.destroy();
    this._cabinetDebugPanel = null;
    this._testUI?.destroy();
    this._testUI = null;
    if (window.location?.search) {
      try { this._cabinetDebugPanel = mountCabinetDebugPanel({window}); }
      catch (error) { LoggerService.error(this, '[GlobalBridge] Cabinet debug panel failed', error); }
      // Portable test panel (Scripts/dev-panel), `?testUI=1` only: loaded on demand so the scene never depends on it.
      if (/[?&]testUI=1(?:&|$)/.test(window.location.search)) {
        const generation = this._testUIGeneration = (this._testUIGeneration ?? 0) + 1;
        import('../../dev-panel/test-ui.mjs')
          .then(({ mountTestUI }) => {
            if (generation !== this._testUIGeneration) return;
            this._testUI = mountTestUI({ window, getAPI: () => window.ConfiguratorAPI });
          })
          .catch(error => LoggerService.error(this, '[GlobalBridge] Test UI failed', error));
      }
    }
  }

  _cleanupCabinetRuntime() {
    this._cabinetDebugPanel?.destroy();
    this._cabinetDebugPanel = null;
    this._testUIGeneration = (this._testUIGeneration ?? 0) + 1; // a pending import must not mount after cleanup
    this._testUI?.destroy();
    this._testUI = null;
    const plugin = this._cabinetRuntimePlugin;
    this._cabinetRuntimePlugin = null;
    if (!plugin) return;
    for (const [name, namespace] of Object.entries(plugin.api)) {
      if (window.ConfiguratorAPI?.[name] === namespace) delete window.ConfiguratorAPI[name];
    }
    plugin.destroy().catch(error => LoggerService.error(this, '[GlobalBridge] ULH runtime cleanup failed', error));
  }

  _cleanupCountertopPlugin() {
    const publicNamespace = this._countertopPlugin?.api;
    const overlayNamespace = this._countertopPlugin?.overlayApi;
    this._countertopPlugin?.destroy();
    this._countertopPlugin = null;

    if (publicNamespace && window.ConfiguratorAPI?.countertop === publicNamespace) {
      delete window.ConfiguratorAPI.countertop;
    }
    if (overlayNamespace && window.ConfiguratorAPI?.countertopOverlay === overlayNamespace) {
      delete window.ConfiguratorAPI.countertopOverlay;
    }
  }

  _cleanupModulesPlugin() {
    const publicNamespace = this._modulesPlugin?.api;
    this._modulesPlugin?.destroy();
    this._modulesPlugin = null;

    if (publicNamespace && window.ConfiguratorAPI?.modules === publicNamespace) {
      delete window.ConfiguratorAPI.modules;
    }
  }

  _cleanupCabinetCoverPlugin() {
    const publicNamespace = this._cabinetCoverPlugin?.api;
    this._cabinetCoverPlugin?.destroy();
    this._cabinetCoverPlugin = null;

    if (publicNamespace && window.ConfiguratorAPI?.cabinetCover === publicNamespace) {
      delete window.ConfiguratorAPI.cabinetCover;
    }
  }

  _wrapMutatingMethodsWithQueue(api, methodNames) {
    let tail = Promise.resolve();

    const waitForCompositionRules = async () => {
      const aggregator = this.app?.compositionManager?.aggregator;
      if (aggregator?.whenIdle) {
        await aggregator.whenIdle();
      }
    };

    for (const name of methodNames) {
      if (typeof api[name] !== 'function') continue;

      const original = api[name];
      api[name] = (...args) => {
        // Activated line compatibility is owned by the modular coordinator. It must
        // bypass the legacy queue and its mutable-source guard entirely. A collection-driven
        // runtime (prepare) shares the queue: the preset itself decides modular vs legacy.
        const modular=this._cabinetRuntimePlugin?.compatibility;
        if(name==='presetProducts'&&modular?.active&&typeof modular.prepare!=='function')return original.apply(api,args);
        // Reject at request time too: a preview-time write must not wait until idle.
        try { this.app?.compositionManager?.assertCompositionMutable?.(); }
        catch (error) { return Promise.reject(error); }
        const run = async () => {
          this.app?.compositionManager?.assertCompositionMutable?.();
          const result = await original.apply(api, args);
          await waitForCompositionRules();
          return result;
        };

        const next = tail.then(run, run);
        tail = next.catch(error => {
          LoggerService.error(
            this,
            `[GlobalBridge] Queued API mutation "${name}" failed`,
            error
          );
        });

        return next;
      };
    }
  }

}
