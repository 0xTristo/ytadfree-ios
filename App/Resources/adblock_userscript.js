// YTAdFree - injected at document-start in every frame.
// Strategy: strip ad-related fields from YouTube's internal player
// response (the same JSON the official app/site uses to schedule ads)
// before YouTube's own JS ever reads it, instead of trying to hide or
// skip ads after they've already started.

(function () {
  'use strict';

  var AD_FIELDS = [
    'adPlacements',
    'playerAds',
    'adSlots',
    'adBreakHeartbeatParams',
    'adBreakServiceParams'
  ];

  function stripAds(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    for (var i = 0; i < AD_FIELDS.length; i++) {
      if (AD_FIELDS[i] in obj) delete obj[AD_FIELDS[i]];
    }
    if (obj.playerResponse) stripAds(obj.playerResponse);
    if (obj.response) stripAds(obj.response);
    return obj;
  }

  function patchJSONText(text) {
    try {
      var obj = JSON.parse(text);
      stripAds(obj);
      return JSON.stringify(obj);
    } catch (e) {
      return text;
    }
  }

  var AD_ENDPOINT_RE = /\/youtubei\/v1\/(player|next)|get_video_info|\/get_midroll_info/;

  // Patch fetch() - YouTube's SPA navigation fetches new player data this way.
  var originalFetch = window.fetch;
  if (originalFetch) {
    window.fetch = function () {
      var args = arguments;
      var urlArg = args[0];
      var url = typeof urlArg === 'string' ? urlArg : (urlArg && urlArg.url) || '';
      return originalFetch.apply(this, args).then(function (response) {
        if (!AD_ENDPOINT_RE.test(url)) return response;
        return response.clone().text().then(function (text) {
          var patched = patchJSONText(text);
          return new Response(patched, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers
          });
        }).catch(function () {
          return response;
        });
      });
    };
  }

  // Patch XMLHttpRequest - fallback path some YouTube clients still use.
  var originalOpen = XMLHttpRequest.prototype.open;
  var originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url) {
    this._ytadfUrl = url;
    return originalOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function () {
    if (this._ytadfUrl && AD_ENDPOINT_RE.test(this._ytadfUrl)) {
      this.addEventListener('readystatechange', function () {
        if (this.readyState === 4 && this.responseText) {
          try {
            var patched = patchJSONText(this.responseText);
            Object.defineProperty(this, 'responseText', { get: function () { return patched; } });
            Object.defineProperty(this, 'response', { get: function () { return patched; } });
          } catch (e) {
            // read-only responseText in some contexts - ignore, cosmetic/skip net below covers it
          }
        }
      });
    }
    return originalSend.apply(this, arguments);
  };

  // Strip the inline ytInitialPlayerResponse present on first page load
  // (the SPA fetch patches above cover subsequent in-app navigation).
  try {
    var currentValue;
    Object.defineProperty(window, 'ytInitialPlayerResponse', {
      configurable: true,
      get: function () { return currentValue; },
      set: function (value) { currentValue = stripAds(value); }
    });
  } catch (e) {}

  // Cosmetic safety net: hide ad UI containers if anything still slips through.
  // Attribute-contains selectors ([class*="..."]) catch YouTube's growing family
  // of "ytp-ad-*" and "*-view-model" ad sub-components without listing every one.
  var HIDE_SELECTORS = [
    '.video-ads', '.ytp-ad-module', '.ytp-ad-overlay-container',
    'ytd-promoted-sparkles-web-renderer', 'ytd-display-ad-renderer',
    'ytd-ad-slot-renderer', '#masthead-ad', 'ytd-companion-slot-renderer',
    'ytd-companion-legal-text-renderer', '.ytp-ad-player-overlay-instream-info',
    '[class*="ytp-ad-"]', '[id*="ytp-ad-"]', '[class*="companion"]',
    'ad-image-view-model', 'ad-avatar-lockup-view-model', 'ad-avatar-view-model',
    'ad-badge-view-model', 'ad-details-line-view-model', 'ad-button-view-model',
    'top-banner-image-text-icon-buttoned-layout-view-model'
  ];

  function injectHideStyle() {
    var style = document.createElement('style');
    style.textContent = HIDE_SELECTORS.join(',') + '{ display: none !important; }';
    (document.head || document.documentElement).appendChild(style);
  }

  if (document.head) {
    injectHideStyle();
  } else {
    document.addEventListener('DOMContentLoaded', injectHideStyle);
  }

  // Behavioural safety net: auto-skip/fast-forward any ad that still starts
  // playing (covers formats the JSON strip above doesn't catch yet).
  setInterval(function () {
    var skipBtn = document.querySelector('.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button');
    if (skipBtn) skipBtn.click();

    var adShowing = document.querySelector('.ad-showing, .ad-interrupting');
    var video = document.querySelector('video');
    if (adShowing && video && isFinite(video.duration)) {
      video.currentTime = video.duration;
    }
  }, 400);

  // Floating button to enter native iOS Picture-in-Picture, since YouTube's
  // own web player controls don't expose WebKit's PiP entry point.
  function ensurePipButton() {
    var video = document.querySelector('video');
    if (!video) return;
    var btn = document.getElementById('ytadf-pip-btn');
    if (btn) return;
    btn = document.createElement('button');
    btn.id = 'ytadf-pip-btn';
    btn.textContent = '⧉';
    btn.style.cssText = 'position:fixed;bottom:24px;right:16px;z-index:2147483647;'
      + 'width:44px;height:44px;border-radius:22px;background:rgba(0,0,0,0.55);'
      + 'color:#fff;font-size:20px;line-height:44px;text-align:center;border:none;padding:0;';
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var v = document.querySelector('video');
      if (v && typeof v.webkitSetPresentationMode === 'function') {
        var next = v.webkitPresentationMode === 'picture-in-picture' ? 'inline' : 'picture-in-picture';
        v.webkitSetPresentationMode(next);
      }
    });
    document.body.appendChild(btn);
  }

  setInterval(ensurePipButton, 1000);
})();
