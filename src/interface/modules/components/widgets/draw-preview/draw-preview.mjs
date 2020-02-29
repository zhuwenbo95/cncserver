/**
 * @file Draw preview/PaperJS widget definition with bindings.
 */
/* globals cncserver */
import { html } from '/modules/hybrids.js';
import apiInit from '/modules/utils/api-init.mjs';
import initSocket from './draw-preview.socket.mjs';
import { initPaper, initOverlay } from './draw-preview.paper.mjs';
import './draw-preview.tools.mjs';

function initState(host, bot) {
  host.stepsPerMM = {
    x: bot.maxArea.width / bot.maxAreaMM.width,
    y: bot.maxArea.height / bot.maxAreaMM.height,
  };
}

function init(host) {
  apiInit(() => {
    if (!host.initialized) {
      host.initialized = true;
      cncserver.api.settings.bot().then(({ data: bot }) => {
        initState(host, bot);
        initPaper(host, bot);
        initOverlay(host, bot);
        initSocket(host);
      });
    }
  });
}

function tabChange(host, { originalTarget: { name } }) {
  host.layer = name;
}

function layerChangeFactory(defaultLayer = '') {
  return {
    set: (host, value) => {
      console.log(`Set layer ${value}`);
      if (host.layers) {
        Object.entries(host.layers).forEach(([key, layer]) => {
          if (key !== 'overlay') {
            layer.visible = key === value;
          }
        });
      }
      return value;
    },
    connect: (host, key) => {
      console.log('Connect layer');
      if (host[key] === undefined) {
        host[key] = defaultLayer;
      }
    },
  };
}

export default styles => ({
  initialized: false,
  layer: layerChangeFactory('stage'),
  paper: null,
  orientation: '0',
  layers: {},
  stepsPerMM: { x: 1, y: 1 },

  render: ({ layer }) => html`
    ${styles} ${init}
    <wl-tab-group onchange=${tabChange}>
      <wl-tab name="draw" checked=${layer === 'draw'}>Draw</wl-tab>
      <wl-tab name="stage" checked=${layer === 'stage'}>Stage</wl-tab>
      <wl-tab name="preview" checked=${layer === 'preview'}>Preview</wl-tab>
    </wl-tab-group>

    <div id="canvas-wrapper">
      <canvas class="simcanvas" id="paper"></canvas>
    </div>
  `,
});
