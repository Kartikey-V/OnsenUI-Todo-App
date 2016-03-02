/*! onsenui v2.0.0-beta.6 - 2016-03-01 */
/*
Copyright 2013-2015 ASIAL CORPORATION

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

*/


/**
 * Minimal animation library for managing css transition on mobile browsers.
 */
window.animit = (function(){
  'use strict';

  var TIMEOUT_RATIO = 1.4;

  var util = {
  };

  // capitalize string
  util.capitalize = function(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  /**
  * @param {Object} params
  * @param {String} params.property
  * @param {Float} params.duration
  * @param {String} params.timing
  */
  util.buildTransitionValue = function(params) {
    params.property = params.property || 'all';
    params.duration = params.duration || 0.4;
    params.timing = params.timing || 'linear';

    var props = params.property.split(/ +/);

    return props.map(function(prop) {
      return prop + ' ' + params.duration + 's ' + params.timing;
    }).join(', ');
  };

  /**
  * Add an event handler on "transitionend" event.
  */
  util.onceOnTransitionEnd = function(element, callback) {
    if (!element) {
      return function() {};
    }

    var fn = function(event) {
      if (element == event.target) {
        event.stopPropagation();
        removeListeners();

        callback();
      }
    };

    var removeListeners = function() {
      util._transitionEndEvents.forEach(function(eventName) {
        element.removeEventListener(eventName, fn, false);
      });
    };

    util._transitionEndEvents.forEach(function(eventName) {
      element.addEventListener(eventName, fn, false);
    });

    return removeListeners;
  };

  util._transitionEndEvents = (function() {

    if ('ontransitionend' in window) {
      return ['transitionend'];
    }

    if ('onwebkittransitionend' in window) {
      return ['webkitTransitionEnd'];
    }

    if (util.vendorPrefix === 'webkit' || util.vendorPrefix === 'o' || util.vendorPrefix === 'moz' || util.vendorPrefix === 'ms') {
      return [util.vendorPrefix + 'TransitionEnd', 'transitionend'];
    }

    return [];
  })();

  util._cssPropertyDict = (function() {
    var styles = window.getComputedStyle(document.documentElement, '');
    var dict = {};
    var a = 'A'.charCodeAt(0);
    var z = 'z'.charCodeAt(0);

    var upper = function(s) {
      return s.substr(1).toUpperCase();
    };

    for (var i = 0; i < styles.length; i++) {

      var key = styles[i]
        .replace(/^[\-]+/, '')
        .replace(/[\-][a-z]/g, upper)
        .replace(/^moz/, 'Moz');

      if (a <= key.charCodeAt(0) && z >= key.charCodeAt(0)) {
        if (key !== 'cssText' && key !== 'parentText') {
          dict[key] = true;
        }
      }
    }

    return dict;
  })();

  util.hasCssProperty = function(name) {
    return name in util._cssPropertyDict;
  };

  /**
   * Vendor prefix for css property.
   */
  util.vendorPrefix = (function() {
    var styles = window.getComputedStyle(document.documentElement, ''),
    pre = (Array.prototype.slice
      .call(styles)
      .join('')
      .match(/-(moz|webkit|ms)-/) || (styles.OLink === '' && ['', 'o'])
    )[1];
    return pre;
  })();

  util.forceLayoutAtOnce = function(elements, callback) {
    this.batchImmediate(function() {
      elements.forEach(function(element) {
        // force layout
        element.offsetHeight;
      });
      callback();
    });
  };

  util.batchImmediate = (function() {
    var callbacks = [];

    return function(callback) {
      if (callbacks.length === 0) {
        setImmediate(function() {
          var concreateCallbacks = callbacks.slice(0);
          callbacks = [];
          concreateCallbacks.forEach(function(callback) {
            callback();
          });
        });
      }

      callbacks.push(callback);
    };
  })();

  util.batchAnimationFrame = (function() {
    var callbacks = [];

    var raf = window.requestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    window.mozRequestAnimationFrame ||
    window.oRequestAnimationFrame ||
    window.msRequestAnimationFrame ||
    function(callback) {
      setTimeout(callback, 1000 / 60);
    };

    return function(callback) {
      if (callbacks.length === 0) {
        raf(function() {
          var concreateCallbacks = callbacks.slice(0);
          callbacks = [];
          concreateCallbacks.forEach(function(callback) {
            callback();
          });
        });
      }

      callbacks.push(callback);
    };
  })();

  util.transitionPropertyName = (function() {
    if (util.hasCssProperty('transitionDuration')) {
      return 'transition';
    }

    if (util.hasCssProperty(util.vendorPrefix + 'TransitionDuration')) {
      return util.vendorPrefix + 'Transition';
    }

    throw new Error('Invalid state');
  })();


  /**
   * @param {HTMLElement} element
   */
  var Animit = function(element) {
    if (!(this instanceof Animit)) {
      return new Animit(element);
    }

    if (element instanceof HTMLElement) {
      this.elements = [element];
    } else if (Object.prototype.toString.call(element) === '[object Array]') {
      this.elements = element;

    } else {
      throw new Error('First argument must be an array or an instance of HTMLElement.');
    }

    this.transitionQueue = [];
    this.lastStyleAttributeDict = [];
  };

  Animit.prototype = {

    /**
     * @property {Array}
     */
    transitionQueue: undefined,

    /**
     * @property {Array}
     */
    elements: undefined,

    /**
     * Start animation sequence with passed animations.
     *
     * @param {Function} callback
     */
    play: function(callback) {
      if (typeof callback === 'function') {
        this.transitionQueue.push(function(done) {
          callback();
          done();
        });
      }

      this.startAnimation();

      return this;
    },

    /**
     * Queue transition animations or other function.
     *
     * e.g. animit(elt).queue({color: 'red'})
     * e.g. animit(elt).queue({color: 'red'}, {duration: 0.4})
     * e.g. animit(elt).queue({css: {color: 'red'}, duration: 0.2})
     *
     * @param {Object|Animit.Transition|Function} transition
     * @param {Object} [options]
     */
    queue: function(transition, options) {
      var queue = this.transitionQueue;

      if (transition && options) {
        options.css = transition;
        transition = new Animit.Transition(options);
      }

      if (!(transition instanceof Function || transition instanceof Animit.Transition)) {
        if (transition.css) {
          transition = new Animit.Transition(transition);
        } else {
          transition = new Animit.Transition({
            css: transition
          });
        }
      }

      if (transition instanceof Function) {
        queue.push(transition);
      } else if (transition instanceof Animit.Transition) {
        queue.push(transition.build());
      } else {
        throw new Error('Invalid arguments');
      }

      return this;
    },

    /**
     * Queue transition animations.
     *
     * @param {Float} seconds
     */
    wait: function(seconds) {
      if (seconds > 0) {
        this.transitionQueue.push(function(done) {
          setTimeout(done, 1000 * seconds);
        });
      }

      return this;
    },

    saveStyle: function() {

      this.transitionQueue.push(function(done) {
        this.elements.forEach(function(element, index) {
          var css = this.lastStyleAttributeDict[index] = {};

          for (var i = 0; i < element.style.length; i++) {
            css[element.style[i]] = element.style[element.style[i]];
          }
        }.bind(this));
        done();
      }.bind(this));

      return this;
    },

    /**
     * Restore element's style.
     *
     * @param {Object} [options]
     * @param {Float} [options.duration]
     * @param {String} [options.timing]
     * @param {String} [options.transition]
     */
    restoreStyle: function(options) {
      options = options || {};
      var self = this;

      if (options.transition && !options.duration) {
        throw new Error('"options.duration" is required when "options.transition" is enabled.');
      }

      var transitionName = util.transitionPropertyName;

      if (options.transition || (options.duration && options.duration > 0)) {
        var transitionValue = options.transition || ('all ' + options.duration + 's ' + (options.timing || 'linear'));

        this.transitionQueue.push(function(done) {
          var elements = this.elements;
          var timeoutId;

          var clearTransition = function() {
            elements.forEach(function(element) {
              element.style[transitionName] = '';
            });
          };

          // add "transitionend" event handler
          var removeListeners = util.onceOnTransitionEnd(elements[0], function() {
            clearTimeout(timeoutId);
            clearTransition();
            done();
          });

          // for fail safe.
          timeoutId = setTimeout(function() {
            removeListeners();
            clearTransition();
            done();
          }, options.duration * 1000 * TIMEOUT_RATIO);

          // transition and style settings
          elements.forEach(function(element, index) {

            var css = self.lastStyleAttributeDict[index];

            if (!css) {
              throw new Error('restoreStyle(): The style is not saved. Invoke saveStyle() before.');
            }

            self.lastStyleAttributeDict[index] = undefined;

            var name;
            for (var i = 0, len = element.style.length; i < len; i++) {
              name = element.style[i];
              if (css[name] === undefined) {
                css[name] = '';
              }
            }

            element.style[transitionName] = transitionValue;

            Object.keys(css).forEach(function(key) {
              if (key !== transitionName) {
                element.style[key] = css[key];
              }
            });

            element.style[transitionName] = transitionValue;
          });
        });
      } else {
        this.transitionQueue.push(function(done) {
          reset();
          done();
        });
      }

      return this;

      function reset() {
        // Clear transition animation settings.
        self.elements.forEach(function(element, index) {
          element.style[transitionName] = 'none';

          var css = self.lastStyleAttributeDict[index];

          if (!css) {
            throw new Error('restoreStyle(): The style is not saved. Invoke saveStyle() before.');
          }

          self.lastStyleAttributeDict[index] = undefined;

          for (var i = 0, name = ''; i < element.style.length; i++) {
            name = element.style[i];
            if (typeof css[element.style[i]] === 'undefined') {
              css[element.style[i]] = '';
            }
          }

          Object.keys(css).forEach(function(key) {
            element.style[key] = css[key];
          });

        });
      }
    },

    /**
     * Start animation sequence.
     */
    startAnimation: function() {
      this._dequeueTransition();

      return this;
    },

    _dequeueTransition: function() {
      var transition = this.transitionQueue.shift();
      if (this._currentTransition) {
        throw new Error('Current transition exists.');
      }
      this._currentTransition = transition;
      var self = this;
      var called = false;

      var done = function() {
        if (!called) {
          called = true;
          self._currentTransition = undefined;
          self._dequeueTransition();
        } else {
          throw new Error('Invalid state: This callback is called twice.');
        }
      };

      if (transition) {
        transition.call(this, done);
      }
    }

  };

  /**
   * @param {Animit} arguments
   */
  Animit.runAll = function(/* arguments... */) {
    for (var i = 0; i < arguments.length; i++) {
      arguments[i].play();
    }
  };


  /**
   * @param {Object} options
   * @param {Float} [options.duration]
   * @param {String} [options.property]
   * @param {String} [options.timing]
   */
  Animit.Transition = function(options) {
    this.options = options || {};
    this.options.duration = this.options.duration || 0;
    this.options.timing = this.options.timing || 'linear';
    this.options.css = this.options.css || {};
    this.options.property = this.options.property || 'all';
  };

  Animit.Transition.prototype = {

    /**
     * @param {HTMLElement} element
     * @return {Function}
     */
    build: function() {

      if (Object.keys(this.options.css).length === 0) {
        throw new Error('options.css is required.');
      }

      var css = createActualCssProps(this.options.css);

      if (this.options.duration > 0) {
        var transitionValue = util.buildTransitionValue(this.options);
        var self = this;

        return function(callback) {
          var elements = this.elements;
          var timeout = self.options.duration * 1000 * TIMEOUT_RATIO;
          var timeoutId;

          var removeListeners = util.onceOnTransitionEnd(elements[0], function() {
            clearTimeout(timeoutId);
            callback();
          });

          timeoutId = setTimeout(function() {
            removeListeners();
            callback();
          }, timeout);

          elements.forEach(function(element) {
            element.style[util.transitionPropertyName] = transitionValue;

            Object.keys(css).forEach(function(name) {
              element.style[name] = css[name];
            });
          });

        };
      }

      if (this.options.duration <= 0) {
        return function(callback) {
          var elements = this.elements;

          elements.forEach(function(element) {
            element.style[util.transitionPropertyName] = '';

            Object.keys(css).forEach(function(name) {
              element.style[name] = css[name];
            });
          });

          if (elements.length > 0) {
            util.forceLayoutAtOnce(elements, function() {
              util.batchAnimationFrame(callback);
            });
          } else {
            util.batchAnimationFrame(callback);
          }
        };
      }

      function createActualCssProps(css) {
        var result = {};

        Object.keys(css).forEach(function(name) {
          var value = css[name];

          if (util.hasCssProperty(name)) {
            result[name] = value;
            return;
          }

          var prefixed = util.vendorPrefix + util.capitalize(name);
          if (util.hasCssProperty(prefixed)) {
            result[prefixed] = value;
          } else {
            result[prefixed] = value;
            result[name] = value;
          }
        });

        return result;
      }

    }
  };


  return Animit;
})();

/*
 * childNode.remove method polyfill for IE.
 * https://developer.mozilla.org/en-US/docs/Web/API/ChildNode/remove
 */

(function() {
	if (!('remove' in Element.prototype)) {
	  Element.prototype.remove = function() {
	    if (this.parentNode) {
	    	this.parentNode.removeChild(this);
	    }
	  };
	}
})();

/*
 * classList.js: Cross-browser full element.classList implementation.
 * 1.1.20150312
 *
 * By Eli Grey, http://eligrey.com
 * License: Dedicated to the public domain.
 *   See https://github.com/eligrey/classList.js/blob/master/LICENSE.md
 */

/*global self, document, DOMException */

/*! @source http://purl.eligrey.com/github/classList.js/blob/master/classList.js */

if ("document" in self) {

// Full polyfill for browsers with no classList support
// Including IE < Edge missing SVGElement.classList
if (!("classList" in document.createElement("_"))
  || document.createElementNS && !("classList" in document.createElementNS("http://www.w3.org/2000/svg","g"))) {

(function (view) {

"use strict";

if (!('Element' in view)) return;

var
    classListProp = "classList"
  , protoProp = "prototype"
  , elemCtrProto = view.Element[protoProp]
  , objCtr = Object
  , strTrim = String[protoProp].trim || function () {
    return this.replace(/^\s+|\s+$/g, "");
  }
  , arrIndexOf = Array[protoProp].indexOf || function (item) {
    var
        i = 0
      , len = this.length
    ;
    for (; i < len; i++) {
      if (i in this && this[i] === item) {
        return i;
      }
    }
    return -1;
  }
  // Vendors: please allow content code to instantiate DOMExceptions
  , DOMEx = function (type, message) {
    this.name = type;
    this.code = DOMException[type];
    this.message = message;
  }
  , checkTokenAndGetIndex = function (classList, token) {
    if (token === "") {
      throw new DOMEx(
          "SYNTAX_ERR"
        , "An invalid or illegal string was specified"
      );
    }
    if (/\s/.test(token)) {
      throw new DOMEx(
          "INVALID_CHARACTER_ERR"
        , "String contains an invalid character"
      );
    }
    return arrIndexOf.call(classList, token);
  }
  , ClassList = function (elem) {
    var
        trimmedClasses = strTrim.call(elem.getAttribute("class") || "")
      , classes = trimmedClasses ? trimmedClasses.split(/\s+/) : []
      , i = 0
      , len = classes.length
    ;
    for (; i < len; i++) {
      this.push(classes[i]);
    }
    this._updateClassName = function () {
      elem.setAttribute("class", this.toString());
    };
  }
  , classListProto = ClassList[protoProp] = []
  , classListGetter = function () {
    return new ClassList(this);
  }
;
// Most DOMException implementations don't allow calling DOMException's toString()
// on non-DOMExceptions. Error's toString() is sufficient here.
DOMEx[protoProp] = Error[protoProp];
classListProto.item = function (i) {
  return this[i] || null;
};
classListProto.contains = function (token) {
  token += "";
  return checkTokenAndGetIndex(this, token) !== -1;
};
classListProto.add = function () {
  var
      tokens = arguments
    , i = 0
    , l = tokens.length
    , token
    , updated = false
  ;
  do {
    token = tokens[i] + "";
    if (checkTokenAndGetIndex(this, token) === -1) {
      this.push(token);
      updated = true;
    }
  }
  while (++i < l);

  if (updated) {
    this._updateClassName();
  }
};
classListProto.remove = function () {
  var
      tokens = arguments
    , i = 0
    , l = tokens.length
    , token
    , updated = false
    , index
  ;
  do {
    token = tokens[i] + "";
    index = checkTokenAndGetIndex(this, token);
    while (index !== -1) {
      this.splice(index, 1);
      updated = true;
      index = checkTokenAndGetIndex(this, token);
    }
  }
  while (++i < l);

  if (updated) {
    this._updateClassName();
  }
};
classListProto.toggle = function (token, force) {
  token += "";

  var
      result = this.contains(token)
    , method = result ?
      force !== true && "remove"
    :
      force !== false && "add"
  ;

  if (method) {
    this[method](token);
  }

  if (force === true || force === false) {
    return force;
  } else {
    return !result;
  }
};
classListProto.toString = function () {
  return this.join(" ");
};

if (objCtr.defineProperty) {
  var classListPropDesc = {
      get: classListGetter
    , enumerable: true
    , configurable: true
  };
  try {
    objCtr.defineProperty(elemCtrProto, classListProp, classListPropDesc);
  } catch (ex) { // IE 8 doesn't support enumerable:true
    if (ex.number === -0x7FF5EC54) {
      classListPropDesc.enumerable = false;
      objCtr.defineProperty(elemCtrProto, classListProp, classListPropDesc);
    }
  }
} else if (objCtr[protoProp].__defineGetter__) {
  elemCtrProto.__defineGetter__(classListProp, classListGetter);
}

}(self));

} else {
// There is full or partial native classList support, so just check if we need
// to normalize the add/remove and toggle APIs.

(function () {
  "use strict";

  var testElement = document.createElement("_");

  testElement.classList.add("c1", "c2");

  // Polyfill for IE 10/11 and Firefox <26, where classList.add and
  // classList.remove exist but support only one argument at a time.
  if (!testElement.classList.contains("c2")) {
    var createMethod = function(method) {
      var original = DOMTokenList.prototype[method];

      DOMTokenList.prototype[method] = function(token) {
        var i, len = arguments.length;

        for (i = 0; i < len; i++) {
          token = arguments[i];
          original.call(this, token);
        }
      };
    };
    createMethod('add');
    createMethod('remove');
  }

  testElement.classList.toggle("c3", false);

  // Polyfill for IE 10 and Firefox <24, where classList.toggle does not
  // support the second argument.
  if (testElement.classList.contains("c3")) {
    var _toggle = DOMTokenList.prototype.toggle;

    DOMTokenList.prototype.toggle = function(token, force) {
      if (1 in arguments && !this.contains(token) === !force) {
        return force;
      } else {
        return _toggle.call(this, token);
      }
    };

  }

  testElement = null;
}());

}

}


/**
 * @license
 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */
// @version 0.7.3
if (typeof WeakMap === "undefined") {
  (function() {
    var defineProperty = Object.defineProperty;
    var counter = Date.now() % 1e9;
    var WeakMap = function() {
      this.name = "__st" + (Math.random() * 1e9 >>> 0) + (counter++ + "__");
    };
    WeakMap.prototype = {
      set: function(key, value) {
        var entry = key[this.name];
        if (entry && entry[0] === key) entry[1] = value; else defineProperty(key, this.name, {
          value: [ key, value ],
          writable: true
        });
        return this;
      },
      get: function(key) {
        var entry;
        return (entry = key[this.name]) && entry[0] === key ? entry[1] : undefined;
      },
      "delete": function(key) {
        var entry = key[this.name];
        if (!entry || entry[0] !== key) return false;
        entry[0] = entry[1] = undefined;
        return true;
      },
      has: function(key) {
        var entry = key[this.name];
        if (!entry) return false;
        return entry[0] === key;
      }
    };
    window.WeakMap = WeakMap;
  })();
}

(function(global) {
  var registrationsTable = new WeakMap();
  var setImmediate;
  if (/Trident|Edge/.test(navigator.userAgent)) {
    setImmediate = setTimeout;
  } else if (window.setImmediate) {
    setImmediate = window.setImmediate;
  } else {
    var setImmediateQueue = [];
    var sentinel = String(Math.random());
    window.addEventListener("message", function(e) {
      if (e.data === sentinel) {
        var queue = setImmediateQueue;
        setImmediateQueue = [];
        queue.forEach(function(func) {
          func();
        });
      }
    });
    setImmediate = function(func) {
      setImmediateQueue.push(func);
      window.postMessage(sentinel, "*");
    };
  }
  var isScheduled = false;
  var scheduledObservers = [];
  function scheduleCallback(observer) {
    scheduledObservers.push(observer);
    if (!isScheduled) {
      isScheduled = true;
      setImmediate(dispatchCallbacks);
    }
  }
  function wrapIfNeeded(node) {
    return window.ShadowDOMPolyfill && window.ShadowDOMPolyfill.wrapIfNeeded(node) || node;
  }
  function dispatchCallbacks() {
    isScheduled = false;
    var observers = scheduledObservers;
    scheduledObservers = [];
    observers.sort(function(o1, o2) {
      return o1.uid_ - o2.uid_;
    });
    var anyNonEmpty = false;
    observers.forEach(function(observer) {
      var queue = observer.takeRecords();
      removeTransientObserversFor(observer);
      if (queue.length) {
        observer.callback_(queue, observer);
        anyNonEmpty = true;
      }
    });
    if (anyNonEmpty) dispatchCallbacks();
  }
  function removeTransientObserversFor(observer) {
    observer.nodes_.forEach(function(node) {
      var registrations = registrationsTable.get(node);
      if (!registrations) return;
      registrations.forEach(function(registration) {
        if (registration.observer === observer) registration.removeTransientObservers();
      });
    });
  }
  function forEachAncestorAndObserverEnqueueRecord(target, callback) {
    for (var node = target; node; node = node.parentNode) {
      var registrations = registrationsTable.get(node);
      if (registrations) {
        for (var j = 0; j < registrations.length; j++) {
          var registration = registrations[j];
          var options = registration.options;
          if (node !== target && !options.subtree) continue;
          var record = callback(options);
          if (record) registration.enqueue(record);
        }
      }
    }
  }
  var uidCounter = 0;
  function JsMutationObserver(callback) {
    this.callback_ = callback;
    this.nodes_ = [];
    this.records_ = [];
    this.uid_ = ++uidCounter;
  }
  JsMutationObserver.prototype = {
    observe: function(target, options) {
      target = wrapIfNeeded(target);
      if (!options.childList && !options.attributes && !options.characterData || options.attributeOldValue && !options.attributes || options.attributeFilter && options.attributeFilter.length && !options.attributes || options.characterDataOldValue && !options.characterData) {
        throw new SyntaxError();
      }
      var registrations = registrationsTable.get(target);
      if (!registrations) registrationsTable.set(target, registrations = []);
      var registration;
      for (var i = 0; i < registrations.length; i++) {
        if (registrations[i].observer === this) {
          registration = registrations[i];
          registration.removeListeners();
          registration.options = options;
          break;
        }
      }
      if (!registration) {
        registration = new Registration(this, target, options);
        registrations.push(registration);
        this.nodes_.push(target);
      }
      registration.addListeners();
    },
    disconnect: function() {
      this.nodes_.forEach(function(node) {
        var registrations = registrationsTable.get(node);
        for (var i = 0; i < registrations.length; i++) {
          var registration = registrations[i];
          if (registration.observer === this) {
            registration.removeListeners();
            registrations.splice(i, 1);
            break;
          }
        }
      }, this);
      this.records_ = [];
    },
    takeRecords: function() {
      var copyOfRecords = this.records_;
      this.records_ = [];
      return copyOfRecords;
    }
  };
  function MutationRecord(type, target) {
    this.type = type;
    this.target = target;
    this.addedNodes = [];
    this.removedNodes = [];
    this.previousSibling = null;
    this.nextSibling = null;
    this.attributeName = null;
    this.attributeNamespace = null;
    this.oldValue = null;
  }
  function copyMutationRecord(original) {
    var record = new MutationRecord(original.type, original.target);
    record.addedNodes = original.addedNodes.slice();
    record.removedNodes = original.removedNodes.slice();
    record.previousSibling = original.previousSibling;
    record.nextSibling = original.nextSibling;
    record.attributeName = original.attributeName;
    record.attributeNamespace = original.attributeNamespace;
    record.oldValue = original.oldValue;
    return record;
  }
  var currentRecord, recordWithOldValue;
  function getRecord(type, target) {
    return currentRecord = new MutationRecord(type, target);
  }
  function getRecordWithOldValue(oldValue) {
    if (recordWithOldValue) return recordWithOldValue;
    recordWithOldValue = copyMutationRecord(currentRecord);
    recordWithOldValue.oldValue = oldValue;
    return recordWithOldValue;
  }
  function clearRecords() {
    currentRecord = recordWithOldValue = undefined;
  }
  function recordRepresentsCurrentMutation(record) {
    return record === recordWithOldValue || record === currentRecord;
  }
  function selectRecord(lastRecord, newRecord) {
    if (lastRecord === newRecord) return lastRecord;
    if (recordWithOldValue && recordRepresentsCurrentMutation(lastRecord)) return recordWithOldValue;
    return null;
  }
  function Registration(observer, target, options) {
    this.observer = observer;
    this.target = target;
    this.options = options;
    this.transientObservedNodes = [];
  }
  Registration.prototype = {
    enqueue: function(record) {
      var records = this.observer.records_;
      var length = records.length;
      if (records.length > 0) {
        var lastRecord = records[length - 1];
        var recordToReplaceLast = selectRecord(lastRecord, record);
        if (recordToReplaceLast) {
          records[length - 1] = recordToReplaceLast;
          return;
        }
      } else {
        scheduleCallback(this.observer);
      }
      records[length] = record;
    },
    addListeners: function() {
      this.addListeners_(this.target);
    },
    addListeners_: function(node) {
      var options = this.options;
      if (options.attributes) node.addEventListener("DOMAttrModified", this, true);
      if (options.characterData) node.addEventListener("DOMCharacterDataModified", this, true);
      if (options.childList) node.addEventListener("DOMNodeInserted", this, true);
      if (options.childList || options.subtree) node.addEventListener("DOMNodeRemoved", this, true);
    },
    removeListeners: function() {
      this.removeListeners_(this.target);
    },
    removeListeners_: function(node) {
      var options = this.options;
      if (options.attributes) node.removeEventListener("DOMAttrModified", this, true);
      if (options.characterData) node.removeEventListener("DOMCharacterDataModified", this, true);
      if (options.childList) node.removeEventListener("DOMNodeInserted", this, true);
      if (options.childList || options.subtree) node.removeEventListener("DOMNodeRemoved", this, true);
    },
    addTransientObserver: function(node) {
      if (node === this.target) return;
      this.addListeners_(node);
      this.transientObservedNodes.push(node);
      var registrations = registrationsTable.get(node);
      if (!registrations) registrationsTable.set(node, registrations = []);
      registrations.push(this);
    },
    removeTransientObservers: function() {
      var transientObservedNodes = this.transientObservedNodes;
      this.transientObservedNodes = [];
      transientObservedNodes.forEach(function(node) {
        this.removeListeners_(node);
        var registrations = registrationsTable.get(node);
        for (var i = 0; i < registrations.length; i++) {
          if (registrations[i] === this) {
            registrations.splice(i, 1);
            break;
          }
        }
      }, this);
    },
    handleEvent: function(e) {
      e.stopImmediatePropagation();
      switch (e.type) {
       case "DOMAttrModified":
        var name = e.attrName;
        var namespace = e.relatedNode.namespaceURI;
        var target = e.target;
        var record = new getRecord("attributes", target);
        record.attributeName = name;
        record.attributeNamespace = namespace;
        var oldValue = e.attrChange === MutationEvent.ADDITION ? null : e.prevValue;
        forEachAncestorAndObserverEnqueueRecord(target, function(options) {
          if (!options.attributes) return;
          if (options.attributeFilter && options.attributeFilter.length && options.attributeFilter.indexOf(name) === -1 && options.attributeFilter.indexOf(namespace) === -1) {
            return;
          }
          if (options.attributeOldValue) return getRecordWithOldValue(oldValue);
          return record;
        });
        break;

       case "DOMCharacterDataModified":
        var target = e.target;
        var record = getRecord("characterData", target);
        var oldValue = e.prevValue;
        forEachAncestorAndObserverEnqueueRecord(target, function(options) {
          if (!options.characterData) return;
          if (options.characterDataOldValue) return getRecordWithOldValue(oldValue);
          return record;
        });
        break;

       case "DOMNodeRemoved":
        this.addTransientObserver(e.target);

       case "DOMNodeInserted":
        var changedNode = e.target;
        var addedNodes, removedNodes;
        if (e.type === "DOMNodeInserted") {
          addedNodes = [ changedNode ];
          removedNodes = [];
        } else {
          addedNodes = [];
          removedNodes = [ changedNode ];
        }
        var previousSibling = changedNode.previousSibling;
        var nextSibling = changedNode.nextSibling;
        var record = getRecord("childList", e.target.parentNode);
        record.addedNodes = addedNodes;
        record.removedNodes = removedNodes;
        record.previousSibling = previousSibling;
        record.nextSibling = nextSibling;
        forEachAncestorAndObserverEnqueueRecord(e.relatedNode, function(options) {
          if (!options.childList) return;
          return record;
        });
      }
      clearRecords();
    }
  };
  global.JsMutationObserver = JsMutationObserver;
  if (!global.MutationObserver) global.MutationObserver = JsMutationObserver;
})(this);

window.CustomElements = window.CustomElements || {
  flags: {}
};

(function(scope) {
  var flags = scope.flags;
  var modules = [];
  var addModule = function(module) {
    modules.push(module);
  };
  var initializeModules = function() {
    modules.forEach(function(module) {
      module(scope);
    });
  };
  scope.addModule = addModule;
  scope.initializeModules = initializeModules;
  scope.hasNative = Boolean(document.registerElement);
  scope.useNative = !flags.register && scope.hasNative && !window.ShadowDOMPolyfill && (!window.HTMLImports || HTMLImports.useNative);
})(window.CustomElements);

window.CustomElements.addModule(function(scope) {
  var IMPORT_LINK_TYPE = window.HTMLImports ? HTMLImports.IMPORT_LINK_TYPE : "none";
  function forSubtree(node, cb) {
    findAllElements(node, function(e) {
      if (cb(e)) {
        return true;
      }
      forRoots(e, cb);
    });
    forRoots(node, cb);
  }
  function findAllElements(node, find, data) {
    var e = node.firstElementChild;
    if (!e) {
      e = node.firstChild;
      while (e && e.nodeType !== Node.ELEMENT_NODE) {
        e = e.nextSibling;
      }
    }
    while (e) {
      if (find(e, data) !== true) {
        findAllElements(e, find, data);
      }
      e = e.nextElementSibling;
    }
    return null;
  }
  function forRoots(node, cb) {
    var root = node.shadowRoot;
    while (root) {
      forSubtree(root, cb);
      root = root.olderShadowRoot;
    }
  }
  function forDocumentTree(doc, cb) {
    _forDocumentTree(doc, cb, []);
  }
  function _forDocumentTree(doc, cb, processingDocuments) {
    doc = wrap(doc);
    if (processingDocuments.indexOf(doc) >= 0) {
      return;
    }
    processingDocuments.push(doc);
    var imports = doc.querySelectorAll("link[rel=" + IMPORT_LINK_TYPE + "]");
    for (var i = 0, l = imports.length, n; i < l && (n = imports[i]); i++) {
      if (n.import) {
        _forDocumentTree(n.import, cb, processingDocuments);
      }
    }
    cb(doc);
  }
  scope.forDocumentTree = forDocumentTree;
  scope.forSubtree = forSubtree;
});

window.CustomElements.addModule(function(scope) {
  var flags = scope.flags;
  var forSubtree = scope.forSubtree;
  var forDocumentTree = scope.forDocumentTree;
  function addedNode(node) {
    return added(node) || addedSubtree(node);
  }
  function added(node) {
    if (scope.upgrade(node)) {
      return true;
    }
    attached(node);
  }
  function addedSubtree(node) {
    forSubtree(node, function(e) {
      if (added(e)) {
        return true;
      }
    });
  }
  function attachedNode(node) {
    attached(node);
    if (inDocument(node)) {
      forSubtree(node, function(e) {
        attached(e);
      });
    }
  }
  var hasPolyfillMutations = !window.MutationObserver || window.MutationObserver === window.JsMutationObserver;
  scope.hasPolyfillMutations = hasPolyfillMutations;
  var isPendingMutations = false;
  var pendingMutations = [];
  function deferMutation(fn) {
    pendingMutations.push(fn);
    if (!isPendingMutations) {
      isPendingMutations = true;
      setTimeout(takeMutations);
    }
  }
  function takeMutations() {
    isPendingMutations = false;
    var $p = pendingMutations;
    for (var i = 0, l = $p.length, p; i < l && (p = $p[i]); i++) {
      p();
    }
    pendingMutations = [];
  }
  function attached(element) {
    if (hasPolyfillMutations) {
      deferMutation(function() {
        _attached(element);
      });
    } else {
      _attached(element);
    }
  }
  function _attached(element) {
    if (element.__upgraded__ && (element.attachedCallback || element.detachedCallback)) {
      if (!element.__attached && inDocument(element)) {
        element.__attached = true;
        if (element.attachedCallback) {
          element.attachedCallback();
        }
      }
    }
  }
  function detachedNode(node) {
    detached(node);
    forSubtree(node, function(e) {
      detached(e);
    });
  }
  function detached(element) {
    if (hasPolyfillMutations) {
      deferMutation(function() {
        _detached(element);
      });
    } else {
      _detached(element);
    }
  }
  function _detached(element) {
    if (element.__upgraded__ && (element.attachedCallback || element.detachedCallback)) {
      if (element.__attached && !inDocument(element)) {
        element.__attached = false;
        if (element.detachedCallback) {
          element.detachedCallback();
        }
      }
    }
  }
  function inDocument(element) {
    var p = element;
    var doc = wrap(document);
    while (p) {
      if (p == doc) {
        return true;
      }
      p = p.parentNode || p.nodeType === Node.DOCUMENT_FRAGMENT_NODE && p.host;
    }
  }
  function watchShadow(node) {
    if (node.shadowRoot && !node.shadowRoot.__watched) {
      flags.dom && console.log("watching shadow-root for: ", node.localName);
      var root = node.shadowRoot;
      while (root) {
        observe(root);
        root = root.olderShadowRoot;
      }
    }
  }
  function handler(mutations) {
    if (flags.dom) {
      var mx = mutations[0];
      if (mx && mx.type === "childList" && mx.addedNodes) {
        if (mx.addedNodes) {
          var d = mx.addedNodes[0];
          while (d && d !== document && !d.host) {
            d = d.parentNode;
          }
          var u = d && (d.URL || d._URL || d.host && d.host.localName) || "";
          u = u.split("/?").shift().split("/").pop();
        }
      }
      console.group("mutations (%d) [%s]", mutations.length, u || "");
    }
    mutations.forEach(function(mx) {
      if (mx.type === "childList") {
        forEach(mx.addedNodes, function(n) {
          if (!n.localName) {
            return;
          }
          addedNode(n);
        });
        forEach(mx.removedNodes, function(n) {
          if (!n.localName) {
            return;
          }
          detachedNode(n);
        });
      }
    });
    flags.dom && console.groupEnd();
  }
  function takeRecords(node) {
    node = wrap(node);
    if (!node) {
      node = wrap(document);
    }
    while (node.parentNode) {
      node = node.parentNode;
    }
    var observer = node.__observer;
    if (observer) {
      handler(observer.takeRecords());
      takeMutations();
    }
  }
  var forEach = Array.prototype.forEach.call.bind(Array.prototype.forEach);
  function observe(inRoot) {
    if (inRoot.__observer) {
      return;
    }
    var observer = new MutationObserver(handler);
    observer.observe(inRoot, {
      childList: true,
      subtree: true
    });
    inRoot.__observer = observer;
  }
  function upgradeDocument(doc) {
    doc = wrap(doc);
    flags.dom && console.group("upgradeDocument: ", doc.baseURI.split("/").pop());
    addedNode(doc);
    observe(doc);
    flags.dom && console.groupEnd();
  }
  function upgradeDocumentTree(doc) {
    forDocumentTree(doc, upgradeDocument);
  }
  var originalCreateShadowRoot = Element.prototype.createShadowRoot;
  if (originalCreateShadowRoot) {
    Element.prototype.createShadowRoot = function() {
      var root = originalCreateShadowRoot.call(this);
      CustomElements.watchShadow(this);
      return root;
    };
  }
  scope.watchShadow = watchShadow;
  scope.upgradeDocumentTree = upgradeDocumentTree;
  scope.upgradeSubtree = addedSubtree;
  scope.upgradeAll = addedNode;
  scope.attachedNode = attachedNode;
  scope.takeRecords = takeRecords;
});

window.CustomElements.addModule(function(scope) {
  var flags = scope.flags;
  function upgrade(node) {
    if (!node.__upgraded__ && node.nodeType === Node.ELEMENT_NODE) {
      var is = node.getAttribute("is");
      var definition = scope.getRegisteredDefinition(is || node.localName);
      if (definition) {
        if (is && definition.tag == node.localName) {
          return upgradeWithDefinition(node, definition);
        } else if (!is && !definition.extends) {
          return upgradeWithDefinition(node, definition);
        }
      }
    }
  }
  function upgradeWithDefinition(element, definition) {
    flags.upgrade && console.group("upgrade:", element.localName);
    if (definition.is) {
      element.setAttribute("is", definition.is);
    }
    implementPrototype(element, definition);
    element.__upgraded__ = true;
    created(element);
    scope.attachedNode(element);
    scope.upgradeSubtree(element);
    flags.upgrade && console.groupEnd();
    return element;
  }
  function implementPrototype(element, definition) {
    if (Object.__proto__) {
      element.__proto__ = definition.prototype;
    } else {
      customMixin(element, definition.prototype, definition.native);
      element.__proto__ = definition.prototype;
    }
  }
  function customMixin(inTarget, inSrc, inNative) {
    var used = {};
    var p = inSrc;
    while (p !== inNative && p !== HTMLElement.prototype) {
      var keys = Object.getOwnPropertyNames(p);
      for (var i = 0, k; k = keys[i]; i++) {
        if (!used[k]) {
          Object.defineProperty(inTarget, k, Object.getOwnPropertyDescriptor(p, k));
          used[k] = 1;
        }
      }
      p = Object.getPrototypeOf(p);
    }
  }
  function created(element) {
    if (element.createdCallback) {
      element.createdCallback();
    }
  }
  scope.upgrade = upgrade;
  scope.upgradeWithDefinition = upgradeWithDefinition;
  scope.implementPrototype = implementPrototype;
});

window.CustomElements.addModule(function(scope) {
  var isIE11OrOlder = scope.isIE11OrOlder;
  var upgradeDocumentTree = scope.upgradeDocumentTree;
  var upgradeAll = scope.upgradeAll;
  var upgradeWithDefinition = scope.upgradeWithDefinition;
  var implementPrototype = scope.implementPrototype;
  var useNative = scope.useNative;
  function register(name, options) {
    var definition = options || {};
    if (!name) {
      throw new Error("document.registerElement: first argument `name` must not be empty");
    }
    if (name.indexOf("-") < 0) {
      throw new Error("document.registerElement: first argument ('name') must contain a dash ('-'). Argument provided was '" + String(name) + "'.");
    }
    if (isReservedTag(name)) {
      throw new Error("Failed to execute 'registerElement' on 'Document': Registration failed for type '" + String(name) + "'. The type name is invalid.");
    }
    if (getRegisteredDefinition(name)) {
      throw new Error("DuplicateDefinitionError: a type with name '" + String(name) + "' is already registered");
    }
    if (!definition.prototype) {
      definition.prototype = Object.create(HTMLElement.prototype);
    }
    definition.__name = name.toLowerCase();
    definition.lifecycle = definition.lifecycle || {};
    definition.ancestry = ancestry(definition.extends);
    resolveTagName(definition);
    resolvePrototypeChain(definition);
    overrideAttributeApi(definition.prototype);
    registerDefinition(definition.__name, definition);
    definition.ctor = generateConstructor(definition);
    definition.ctor.prototype = definition.prototype;
    definition.prototype.constructor = definition.ctor;
    if (scope.ready) {
      upgradeDocumentTree(document);
    }
    return definition.ctor;
  }
  function overrideAttributeApi(prototype) {
    if (prototype.setAttribute._polyfilled) {
      return;
    }
    var setAttribute = prototype.setAttribute;
    prototype.setAttribute = function(name, value) {
      changeAttribute.call(this, name, value, setAttribute);
    };
    var removeAttribute = prototype.removeAttribute;
    prototype.removeAttribute = function(name) {
      changeAttribute.call(this, name, null, removeAttribute);
    };
    prototype.setAttribute._polyfilled = true;
  }
  function changeAttribute(name, value, operation) {
    name = name.toLowerCase();
    var oldValue = this.getAttribute(name);
    operation.apply(this, arguments);
    var newValue = this.getAttribute(name);
    if (this.attributeChangedCallback && newValue !== oldValue) {
      this.attributeChangedCallback(name, oldValue, newValue);
    }
  }
  function isReservedTag(name) {
    for (var i = 0; i < reservedTagList.length; i++) {
      if (name === reservedTagList[i]) {
        return true;
      }
    }
  }
  var reservedTagList = [ "annotation-xml", "color-profile", "font-face", "font-face-src", "font-face-uri", "font-face-format", "font-face-name", "missing-glyph" ];
  function ancestry(extnds) {
    var extendee = getRegisteredDefinition(extnds);
    if (extendee) {
      return ancestry(extendee.extends).concat([ extendee ]);
    }
    return [];
  }
  function resolveTagName(definition) {
    var baseTag = definition.extends;
    for (var i = 0, a; a = definition.ancestry[i]; i++) {
      baseTag = a.is && a.tag;
    }
    definition.tag = baseTag || definition.__name;
    if (baseTag) {
      definition.is = definition.__name;
    }
  }
  function resolvePrototypeChain(definition) {
    if (!Object.__proto__) {
      var nativePrototype = HTMLElement.prototype;
      if (definition.is) {
        var inst = document.createElement(definition.tag);
        var expectedPrototype = Object.getPrototypeOf(inst);
        if (expectedPrototype === definition.prototype) {
          nativePrototype = expectedPrototype;
        }
      }
      var proto = definition.prototype, ancestor;
      while (proto && proto !== nativePrototype) {
        ancestor = Object.getPrototypeOf(proto);
        proto.__proto__ = ancestor;
        proto = ancestor;
      }
      definition.native = nativePrototype;
    }
  }
  function instantiate(definition) {
    return upgradeWithDefinition(domCreateElement(definition.tag), definition);
  }
  var registry = {};
  function getRegisteredDefinition(name) {
    if (name) {
      return registry[name.toLowerCase()];
    }
  }
  function registerDefinition(name, definition) {
    registry[name] = definition;
  }
  function generateConstructor(definition) {
    return function() {
      return instantiate(definition);
    };
  }
  var HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
  function createElementNS(namespace, tag, typeExtension) {
    if (namespace === HTML_NAMESPACE) {
      return createElement(tag, typeExtension);
    } else {
      return domCreateElementNS(namespace, tag);
    }
  }
  function createElement(tag, typeExtension) {
    if (tag) {
      tag = tag.toLowerCase();
    }
    if (typeExtension) {
      typeExtension = typeExtension.toLowerCase();
    }
    var definition = getRegisteredDefinition(typeExtension || tag);
    if (definition) {
      if (tag == definition.tag && typeExtension == definition.is) {
        return new definition.ctor();
      }
      if (!typeExtension && !definition.is) {
        return new definition.ctor();
      }
    }
    var element;
    if (typeExtension) {
      element = createElement(tag);
      element.setAttribute("is", typeExtension);
      return element;
    }
    element = domCreateElement(tag);
    if (tag.indexOf("-") >= 0) {
      implementPrototype(element, HTMLElement);
    }
    return element;
  }
  var domCreateElement = document.createElement.bind(document);
  var domCreateElementNS = document.createElementNS.bind(document);
  var isInstance;
  if (!Object.__proto__ && !useNative) {
    isInstance = function(obj, ctor) {
      var p = obj;
      while (p) {
        if (p === ctor.prototype) {
          return true;
        }
        p = p.__proto__;
      }
      return false;
    };
  } else {
    isInstance = function(obj, base) {
      return obj instanceof base;
    };
  }
  function wrapDomMethodToForceUpgrade(obj, methodName) {
    var orig = obj[methodName];
    obj[methodName] = function() {
      var n = orig.apply(this, arguments);
      upgradeAll(n);
      return n;
    };
  }
  wrapDomMethodToForceUpgrade(Node.prototype, "cloneNode");
  wrapDomMethodToForceUpgrade(document, "importNode");
  if (isIE11OrOlder) {
    (function() {
      var importNode = document.importNode;
      document.importNode = function() {
        var n = importNode.apply(document, arguments);
        if (n.nodeType == n.DOCUMENT_FRAGMENT_NODE) {
          var f = document.createDocumentFragment();
          f.appendChild(n);
          return f;
        } else {
          return n;
        }
      };
    })();
  }
  document.registerElement = register;
  document.createElement = createElement;
  document.createElementNS = createElementNS;
  scope.registry = registry;
  scope.instanceof = isInstance;
  scope.reservedTagList = reservedTagList;
  scope.getRegisteredDefinition = getRegisteredDefinition;
  document.register = document.registerElement;
});

(function(scope) {
  var useNative = scope.useNative;
  var initializeModules = scope.initializeModules;
  var isIE11OrOlder = /Trident/.test(navigator.userAgent);
  if (useNative) {
    var nop = function() {};
    scope.watchShadow = nop;
    scope.upgrade = nop;
    scope.upgradeAll = nop;
    scope.upgradeDocumentTree = nop;
    scope.upgradeSubtree = nop;
    scope.takeRecords = nop;
    scope.instanceof = function(obj, base) {
      return obj instanceof base;
    };
  } else {
    initializeModules();
  }
  var upgradeDocumentTree = scope.upgradeDocumentTree;
  if (!window.wrap) {
    if (window.ShadowDOMPolyfill) {
      window.wrap = ShadowDOMPolyfill.wrapIfNeeded;
      window.unwrap = ShadowDOMPolyfill.unwrapIfNeeded;
    } else {
      window.wrap = window.unwrap = function(node) {
        return node;
      };
    }
  }
  function bootstrap() {
    upgradeDocumentTree(wrap(document));
    if (window.HTMLImports) {
      HTMLImports.__importsParsingHook = function(elt) {
        upgradeDocumentTree(wrap(elt.import));
      };
    }
    CustomElements.ready = true;
    setTimeout(function() {
      CustomElements.readyTime = Date.now();
      if (window.HTMLImports) {
        CustomElements.elapsed = CustomElements.readyTime - HTMLImports.readyTime;
      }
      document.dispatchEvent(new CustomEvent("WebComponentsReady", {
        bubbles: true
      }));
    });
  }
  if (isIE11OrOlder && typeof window.CustomEvent !== "function") {
    window.CustomEvent = function(inType, params) {
      params = params || {};
      var e = document.createEvent("CustomEvent");
      e.initCustomEvent(inType, Boolean(params.bubbles), Boolean(params.cancelable), params.detail);
      return e;
    };
    window.CustomEvent.prototype = window.Event.prototype;
  }
  if (document.readyState === "complete" || scope.flags.eager) {
    bootstrap();
  } else if (document.readyState === "interactive" && !window.attachEvent && (!window.HTMLImports || window.HTMLImports.ready)) {
    bootstrap();
  } else {
    var loadEvent = window.HTMLImports && !HTMLImports.ready ? "HTMLImportsLoaded" : "DOMContentLoaded";
    window.addEventListener(loadEvent, bootstrap);
  }
  scope.isIE11OrOlder = isIE11OrOlder;
})(window.CustomElements);

if (!window.CustomEvent) {
  (function() {
    var CustomEvent;

    CustomEvent = function(event, params) {
      var evt;
      params = params || {
        bubbles: false,
        cancelable: false,
        detail: undefined
      };
      evt = document.createEvent("CustomEvent");
      evt.initCustomEvent(event, params.bubbles, params.cancelable, params.detail);
      return evt;
    };

    CustomEvent.prototype = window.Event.prototype;

    window.CustomEvent = CustomEvent;
  })();
}

;(function () {
	'use strict';

	/**
	 * @preserve FastClick: polyfill to remove click delays on browsers with touch UIs.
	 *
	 * @codingstandard ftlabs-jsv2
	 * @copyright The Financial Times Limited [All Rights Reserved]
	 * @license MIT License (see LICENSE.txt)
	 */

	/*jslint browser:true, node:true*/
	/*global define, Event, Node*/


	/**
	 * Instantiate fast-clicking listeners on the specified layer.
	 *
	 * @constructor
	 * @param {Element} layer The layer to listen on
	 * @param {Object} [options={}] The options to override the defaults
	 */
	function FastClick(layer, options) {
		var oldOnClick;

		options = options || {};

		/**
		 * Whether a click is currently being tracked.
		 *
		 * @type boolean
		 */
		this.trackingClick = false;


		/**
		 * Timestamp for when click tracking started.
		 *
		 * @type number
		 */
		this.trackingClickStart = 0;


		/**
		 * The element being tracked for a click.
		 *
		 * @type EventTarget
		 */
		this.targetElement = null;


		/**
		 * X-coordinate of touch start event.
		 *
		 * @type number
		 */
		this.touchStartX = 0;


		/**
		 * Y-coordinate of touch start event.
		 *
		 * @type number
		 */
		this.touchStartY = 0;


		/**
		 * ID of the last touch, retrieved from Touch.identifier.
		 *
		 * @type number
		 */
		this.lastTouchIdentifier = 0;


		/**
		 * Touchmove boundary, beyond which a click will be cancelled.
		 *
		 * @type number
		 */
		this.touchBoundary = options.touchBoundary || 10;


		/**
		 * The FastClick layer.
		 *
		 * @type Element
		 */
		this.layer = layer;

		/**
		 * The minimum time between tap(touchstart and touchend) events
		 *
		 * @type number
		 */
		this.tapDelay = options.tapDelay || 200;

		/**
		 * The maximum time for a tap
		 *
		 * @type number
		 */
		this.tapTimeout = options.tapTimeout || 700;

		if (FastClick.notNeeded(layer)) {
			return;
		}

		// Some old versions of Android don't have Function.prototype.bind
		function bind(method, context) {
			return function() { return method.apply(context, arguments); };
		}


		var methods = ['onMouse', 'onClick', 'onTouchStart', 'onTouchMove', 'onTouchEnd', 'onTouchCancel'];
		var context = this;
		for (var i = 0, l = methods.length; i < l; i++) {
			context[methods[i]] = bind(context[methods[i]], context);
		}

		// Set up event handlers as required
		if (deviceIsAndroid) {
			layer.addEventListener('mouseover', this.onMouse, true);
			layer.addEventListener('mousedown', this.onMouse, true);
			layer.addEventListener('mouseup', this.onMouse, true);
		}

		layer.addEventListener('click', this.onClick, true);
		layer.addEventListener('touchstart', this.onTouchStart, false);
		layer.addEventListener('touchmove', this.onTouchMove, false);
		layer.addEventListener('touchend', this.onTouchEnd, false);
		layer.addEventListener('touchcancel', this.onTouchCancel, false);

		// Hack is required for browsers that don't support Event#stopImmediatePropagation (e.g. Android 2)
		// which is how FastClick normally stops click events bubbling to callbacks registered on the FastClick
		// layer when they are cancelled.
		if (!Event.prototype.stopImmediatePropagation) {
			layer.removeEventListener = function(type, callback, capture) {
				var rmv = Node.prototype.removeEventListener;
				if (type === 'click') {
					rmv.call(layer, type, callback.hijacked || callback, capture);
				} else {
					rmv.call(layer, type, callback, capture);
				}
			};

			layer.addEventListener = function(type, callback, capture) {
				var adv = Node.prototype.addEventListener;
				if (type === 'click') {
					adv.call(layer, type, callback.hijacked || (callback.hijacked = function(event) {
						if (!event.propagationStopped) {
							callback(event);
						}
					}), capture);
				} else {
					adv.call(layer, type, callback, capture);
				}
			};
		}

		// If a handler is already declared in the element's onclick attribute, it will be fired before
		// FastClick's onClick handler. Fix this by pulling out the user-defined handler function and
		// adding it as listener.
		if (typeof layer.onclick === 'function') {

			// Android browser on at least 3.2 requires a new reference to the function in layer.onclick
			// - the old one won't work if passed to addEventListener directly.
			oldOnClick = layer.onclick;
			layer.addEventListener('click', function(event) {
				oldOnClick(event);
			}, false);
			layer.onclick = null;
		}
	}

	/**
	* Windows Phone 8.1 fakes user agent string to look like Android and iPhone.
	*
	* @type boolean
	*/
	var deviceIsWindowsPhone = navigator.userAgent.indexOf("Windows Phone") >= 0;

	/**
	 * Android requires exceptions.
	 *
	 * @type boolean
	 */
	var deviceIsAndroid = navigator.userAgent.indexOf('Android') > 0 && !deviceIsWindowsPhone;


	/**
	 * iOS requires exceptions.
	 *
	 * @type boolean
	 */
	var deviceIsIOS = /iP(ad|hone|od)/.test(navigator.userAgent) && !deviceIsWindowsPhone;


	/**
	 * iOS 4 requires an exception for select elements.
	 *
	 * @type boolean
	 */
	var deviceIsIOS4 = deviceIsIOS && (/OS 4_\d(_\d)?/).test(navigator.userAgent);


	/**
	 * iOS 6.0-7.* requires the target element to be manually derived
	 *
	 * @type boolean
	 */
	var deviceIsIOSWithBadTarget = deviceIsIOS && (/OS [6-7]_\d/).test(navigator.userAgent);

	/**
	 * BlackBerry requires exceptions.
	 *
	 * @type boolean
	 */
	var deviceIsBlackBerry10 = navigator.userAgent.indexOf('BB10') > 0;

	/**
	 * Determine whether a given element requires a native click.
	 *
	 * @param {EventTarget|Element} target Target DOM element
	 * @returns {boolean} Returns true if the element needs a native click
	 */
	FastClick.prototype.needsClick = function(target) {
		switch (target.nodeName.toLowerCase()) {

		// Don't send a synthetic click to disabled inputs (issue #62)
		case 'button':
		case 'select':
		case 'textarea':
			if (target.disabled) {
				return true;
			}

			break;
		case 'input':

			// File inputs need real clicks on iOS 6 due to a browser bug (issue #68)
			if ((deviceIsIOS && target.type === 'file') || target.disabled) {
				return true;
			}

			break;
		case 'label':
		case 'iframe': // iOS8 homescreen apps can prevent events bubbling into frames
		case 'video':
			return true;
		}

		return (/\bneedsclick\b/).test(target.className);
	};


	/**
	 * Determine whether a given element requires a call to focus to simulate click into element.
	 *
	 * @param {EventTarget|Element} target Target DOM element
	 * @returns {boolean} Returns true if the element requires a call to focus to simulate native click.
	 */
	FastClick.prototype.needsFocus = function(target) {
		switch (target.nodeName.toLowerCase()) {
		case 'textarea':
			return true;
		case 'select':
			return !deviceIsAndroid;
		case 'input':
			switch (target.type) {
			case 'button':
			case 'checkbox':
			case 'file':
			case 'image':
			case 'radio':
			case 'submit':
				return false;
			}

			// No point in attempting to focus disabled inputs
			return !target.disabled && !target.readOnly;
		default:
			return (/\bneedsfocus\b/).test(target.className);
		}
	};


	/**
	 * Send a click event to the specified element.
	 *
	 * @param {EventTarget|Element} targetElement
	 * @param {Event} event
	 */
	FastClick.prototype.sendClick = function(targetElement, event) {
		var clickEvent, touch;

		// On some Android devices activeElement needs to be blurred otherwise the synthetic click will have no effect (#24)
		if (document.activeElement && document.activeElement !== targetElement) {
			document.activeElement.blur();
		}

		touch = event.changedTouches[0];

		// Synthesize a click event, with an extra attribute so it can be tracked
		clickEvent = document.createEvent('MouseEvents');
		clickEvent.initMouseEvent(this.determineEventType(targetElement), true, true, window, 1, touch.screenX, touch.screenY, touch.clientX, touch.clientY, false, false, false, false, 0, null);
		clickEvent.forwardedTouchEvent = true;
		targetElement.dispatchEvent(clickEvent);
	};

	FastClick.prototype.determineEventType = function(targetElement) {

		//Issue #159: Android Chrome Select Box does not open with a synthetic click event
		if (deviceIsAndroid && targetElement.tagName.toLowerCase() === 'select') {
			return 'mousedown';
		}

		return 'click';
	};


	/**
	 * @param {EventTarget|Element} targetElement
	 */
	FastClick.prototype.focus = function(targetElement) {
		var length;

		// Issue #160: on iOS 7, some input elements (e.g. date datetime month) throw a vague TypeError on setSelectionRange. These elements don't have an integer value for the selectionStart and selectionEnd properties, but unfortunately that can't be used for detection because accessing the properties also throws a TypeError. Just check the type instead. Filed as Apple bug #15122724.
		if (deviceIsIOS && targetElement.setSelectionRange && targetElement.type.indexOf('date') !== 0 && targetElement.type !== 'time' && targetElement.type !== 'month') {
			length = targetElement.value.length;
			targetElement.setSelectionRange(length, length);
		} else {
			targetElement.focus();
		}
	};


	/**
	 * Check whether the given target element is a child of a scrollable layer and if so, set a flag on it.
	 *
	 * @param {EventTarget|Element} targetElement
	 */
	FastClick.prototype.updateScrollParent = function(targetElement) {
		var scrollParent, parentElement;

		scrollParent = targetElement.fastClickScrollParent;

		// Attempt to discover whether the target element is contained within a scrollable layer. Re-check if the
		// target element was moved to another parent.
		if (!scrollParent || !scrollParent.contains(targetElement)) {
			parentElement = targetElement;
			do {
				if (parentElement.scrollHeight > parentElement.offsetHeight) {
					scrollParent = parentElement;
					targetElement.fastClickScrollParent = parentElement;
					break;
				}

				parentElement = parentElement.parentElement;
			} while (parentElement);
		}

		// Always update the scroll top tracker if possible.
		if (scrollParent) {
			scrollParent.fastClickLastScrollTop = scrollParent.scrollTop;
		}
	};


	/**
	 * @param {EventTarget} targetElement
	 * @returns {Element|EventTarget}
	 */
	FastClick.prototype.getTargetElementFromEventTarget = function(eventTarget) {

		// On some older browsers (notably Safari on iOS 4.1 - see issue #56) the event target may be a text node.
		if (eventTarget.nodeType === Node.TEXT_NODE) {
			return eventTarget.parentNode;
		}

		return eventTarget;
	};


	/**
	 * On touch start, record the position and scroll offset.
	 *
	 * @param {Event} event
	 * @returns {boolean}
	 */
	FastClick.prototype.onTouchStart = function(event) {
		var targetElement, touch, selection;

		// Ignore multiple touches, otherwise pinch-to-zoom is prevented if both fingers are on the FastClick element (issue #111).
		if (event.targetTouches.length > 1) {
			return true;
		}

		targetElement = this.getTargetElementFromEventTarget(event.target);
		touch = event.targetTouches[0];

		if (deviceIsIOS) {

			// Only trusted events will deselect text on iOS (issue #49)
			selection = window.getSelection();
			if (selection.rangeCount && !selection.isCollapsed) {
				return true;
			}

			if (!deviceIsIOS4) {

				// Weird things happen on iOS when an alert or confirm dialog is opened from a click event callback (issue #23):
				// when the user next taps anywhere else on the page, new touchstart and touchend events are dispatched
				// with the same identifier as the touch event that previously triggered the click that triggered the alert.
				// Sadly, there is an issue on iOS 4 that causes some normal touch events to have the same identifier as an
				// immediately preceding touch event (issue #52), so this fix is unavailable on that platform.
				// Issue 120: touch.identifier is 0 when Chrome dev tools 'Emulate touch events' is set with an iOS device UA string,
				// which causes all touch events to be ignored. As this block only applies to iOS, and iOS identifiers are always long,
				// random integers, it's safe to to continue if the identifier is 0 here.
				if (touch.identifier && touch.identifier === this.lastTouchIdentifier) {
					event.preventDefault();
					return false;
				}

				this.lastTouchIdentifier = touch.identifier;

				// If the target element is a child of a scrollable layer (using -webkit-overflow-scrolling: touch) and:
				// 1) the user does a fling scroll on the scrollable layer
				// 2) the user stops the fling scroll with another tap
				// then the event.target of the last 'touchend' event will be the element that was under the user's finger
				// when the fling scroll was started, causing FastClick to send a click event to that layer - unless a check
				// is made to ensure that a parent layer was not scrolled before sending a synthetic click (issue #42).
				this.updateScrollParent(targetElement);
			}
		}

		this.trackingClick = true;
		this.trackingClickStart = event.timeStamp;
		this.targetElement = targetElement;

		this.touchStartX = touch.pageX;
		this.touchStartY = touch.pageY;

		// Prevent phantom clicks on fast double-tap (issue #36)
		if ((event.timeStamp - this.lastClickTime) < this.tapDelay && (event.timeStamp - this.lastClickTime) > -1) {
			event.preventDefault();
		}

		return true;
	};


	/**
	 * Based on a touchmove event object, check whether the touch has moved past a boundary since it started.
	 *
	 * @param {Event} event
	 * @returns {boolean}
	 */
	FastClick.prototype.touchHasMoved = function(event) {
		var touch = event.changedTouches[0], boundary = this.touchBoundary;

		if (Math.abs(touch.pageX - this.touchStartX) > boundary || Math.abs(touch.pageY - this.touchStartY) > boundary) {
			return true;
		}

		return false;
	};


	/**
	 * Update the last position.
	 *
	 * @param {Event} event
	 * @returns {boolean}
	 */
	FastClick.prototype.onTouchMove = function(event) {
		if (!this.trackingClick) {
			return true;
		}

		// If the touch has moved, cancel the click tracking
		if (this.targetElement !== this.getTargetElementFromEventTarget(event.target) || this.touchHasMoved(event)) {
			this.trackingClick = false;
			this.targetElement = null;
		}

		return true;
	};


	/**
	 * Attempt to find the labelled control for the given label element.
	 *
	 * @param {EventTarget|HTMLLabelElement} labelElement
	 * @returns {Element|null}
	 */
	FastClick.prototype.findControl = function(labelElement) {

		// Fast path for newer browsers supporting the HTML5 control attribute
		if (labelElement.control !== undefined) {
			return labelElement.control;
		}

		// All browsers under test that support touch events also support the HTML5 htmlFor attribute
		if (labelElement.htmlFor) {
			return document.getElementById(labelElement.htmlFor);
		}

		// If no for attribute exists, attempt to retrieve the first labellable descendant element
		// the list of which is defined here: http://www.w3.org/TR/html5/forms.html#category-label
		return labelElement.querySelector('button, input:not([type=hidden]), keygen, meter, output, progress, select, textarea');
	};


	/**
	 * On touch end, determine whether to send a click event at once.
	 *
	 * @param {Event} event
	 * @returns {boolean}
	 */
	FastClick.prototype.onTouchEnd = function(event) {
		var forElement, trackingClickStart, targetTagName, scrollParent, touch, targetElement = this.targetElement;

		if (!this.trackingClick) {
			return true;
		}

		// Prevent phantom clicks on fast double-tap (issue #36)
		if ((event.timeStamp - this.lastClickTime) < this.tapDelay && (event.timeStamp - this.lastClickTime) > -1) {
			this.cancelNextClick = true;
			return true;
		}

		if ((event.timeStamp - this.trackingClickStart) > this.tapTimeout) {
			return true;
		}

		// Reset to prevent wrong click cancel on input (issue #156).
		this.cancelNextClick = false;

		this.lastClickTime = event.timeStamp;

		trackingClickStart = this.trackingClickStart;
		this.trackingClick = false;
		this.trackingClickStart = 0;

		// On some iOS devices, the targetElement supplied with the event is invalid if the layer
		// is performing a transition or scroll, and has to be re-detected manually. Note that
		// for this to function correctly, it must be called *after* the event target is checked!
		// See issue #57; also filed as rdar://13048589 .
		if (deviceIsIOSWithBadTarget) {
			touch = event.changedTouches[0];

			// In certain cases arguments of elementFromPoint can be negative, so prevent setting targetElement to null
			targetElement = document.elementFromPoint(touch.pageX - window.pageXOffset, touch.pageY - window.pageYOffset) || targetElement;
			targetElement.fastClickScrollParent = this.targetElement.fastClickScrollParent;
		}

		targetTagName = targetElement.tagName.toLowerCase();
		if (targetTagName === 'label') {
			forElement = this.findControl(targetElement);
			if (forElement) {
				this.focus(targetElement);
				if (deviceIsAndroid) {
					return false;
				}

				targetElement = forElement;
			}
		} else if (this.needsFocus(targetElement)) {

			// Case 1: If the touch started a while ago (best guess is 100ms based on tests for issue #36) then focus will be triggered anyway. Return early and unset the target element reference so that the subsequent click will be allowed through.
			// Case 2: Without this exception for input elements tapped when the document is contained in an iframe, then any inputted text won't be visible even though the value attribute is updated as the user types (issue #37).
			if ((event.timeStamp - trackingClickStart) > 100 || (deviceIsIOS && window.top !== window && targetTagName === 'input')) {
				this.targetElement = null;
				return false;
			}

			this.focus(targetElement);
			this.sendClick(targetElement, event);

			// Select elements need the event to go through on iOS 4, otherwise the selector menu won't open.
			// Also this breaks opening selects when VoiceOver is active on iOS6, iOS7 (and possibly others)
			if (!deviceIsIOS || targetTagName !== 'select') {
				this.targetElement = null;
				event.preventDefault();
			}

			return false;
		}

		if (deviceIsIOS && !deviceIsIOS4) {

			// Don't send a synthetic click event if the target element is contained within a parent layer that was scrolled
			// and this tap is being used to stop the scrolling (usually initiated by a fling - issue #42).
			scrollParent = targetElement.fastClickScrollParent;
			if (scrollParent && scrollParent.fastClickLastScrollTop !== scrollParent.scrollTop) {
				return true;
			}
		}

		// Prevent the actual click from going though - unless the target node is marked as requiring
		// real clicks or if it is in the whitelist in which case only non-programmatic clicks are permitted.
		if (!this.needsClick(targetElement)) {
			event.preventDefault();
			this.sendClick(targetElement, event);
		}

		return false;
	};


	/**
	 * On touch cancel, stop tracking the click.
	 *
	 * @returns {void}
	 */
	FastClick.prototype.onTouchCancel = function() {
		this.trackingClick = false;
		this.targetElement = null;
	};


	/**
	 * Determine mouse events which should be permitted.
	 *
	 * @param {Event} event
	 * @returns {boolean}
	 */
	FastClick.prototype.onMouse = function(event) {

		// If a target element was never set (because a touch event was never fired) allow the event
		if (!this.targetElement) {
			return true;
		}

		if (event.forwardedTouchEvent) {
			return true;
		}

		// Programmatically generated events targeting a specific element should be permitted
		if (!event.cancelable) {
			return true;
		}

		// Derive and check the target element to see whether the mouse event needs to be permitted;
		// unless explicitly enabled, prevent non-touch click events from triggering actions,
		// to prevent ghost/doubleclicks.
		if (!this.needsClick(this.targetElement) || this.cancelNextClick) {

			// Prevent any user-added listeners declared on FastClick element from being fired.
			if (event.stopImmediatePropagation) {
				event.stopImmediatePropagation();
			} else {

				// Part of the hack for browsers that don't support Event#stopImmediatePropagation (e.g. Android 2)
				event.propagationStopped = true;
			}

			// Cancel the event
			event.stopPropagation();
			event.preventDefault();

			return false;
		}

		// If the mouse event is permitted, return true for the action to go through.
		return true;
	};


	/**
	 * On actual clicks, determine whether this is a touch-generated click, a click action occurring
	 * naturally after a delay after a touch (which needs to be cancelled to avoid duplication), or
	 * an actual click which should be permitted.
	 *
	 * @param {Event} event
	 * @returns {boolean}
	 */
	FastClick.prototype.onClick = function(event) {
		var permitted;

		// It's possible for another FastClick-like library delivered with third-party code to fire a click event before FastClick does (issue #44). In that case, set the click-tracking flag back to false and return early. This will cause onTouchEnd to return early.
		if (this.trackingClick) {
			this.targetElement = null;
			this.trackingClick = false;
			return true;
		}

		// Very odd behavior on iOS (issue #18): if a submit element is present inside a form and the user hits enter in the iOS simulator or clicks the Go button on the pop-up OS keyboard the a kind of 'fake' click event will be triggered with the submit-type input element as the target.
		if (event.target.type === 'submit' && event.detail === 0) {
			return true;
		}

		permitted = this.onMouse(event);

		// Only unset targetElement if the click is not permitted. This will ensure that the check for !targetElement in onMouse fails and the browser's click doesn't go through.
		if (!permitted) {
			this.targetElement = null;
		}

		// If clicks are permitted, return true for the action to go through.
		return permitted;
	};


	/**
	 * Remove all FastClick's event listeners.
	 *
	 * @returns {void}
	 */
	FastClick.prototype.destroy = function() {
		var layer = this.layer;

		if (deviceIsAndroid) {
			layer.removeEventListener('mouseover', this.onMouse, true);
			layer.removeEventListener('mousedown', this.onMouse, true);
			layer.removeEventListener('mouseup', this.onMouse, true);
		}

		layer.removeEventListener('click', this.onClick, true);
		layer.removeEventListener('touchstart', this.onTouchStart, false);
		layer.removeEventListener('touchmove', this.onTouchMove, false);
		layer.removeEventListener('touchend', this.onTouchEnd, false);
		layer.removeEventListener('touchcancel', this.onTouchCancel, false);
	};


	/**
	 * Check whether FastClick is needed.
	 *
	 * @param {Element} layer The layer to listen on
	 */
	FastClick.notNeeded = function(layer) {
		var metaViewport;
		var chromeVersion;
		var blackberryVersion;
		var firefoxVersion;

		// Devices that don't support touch don't need FastClick
		if (typeof window.ontouchstart === 'undefined') {
			return true;
		}

		// Chrome version - zero for other browsers
		chromeVersion = +(/Chrome\/([0-9]+)/.exec(navigator.userAgent) || [,0])[1];

		if (chromeVersion) {

			if (deviceIsAndroid) {
				metaViewport = document.querySelector('meta[name=viewport]');

				if (metaViewport) {
					// Chrome on Android with user-scalable="no" doesn't need FastClick (issue #89)
					if (metaViewport.content.indexOf('user-scalable=no') !== -1) {
						return true;
					}
					// Chrome 32 and above with width=device-width or less don't need FastClick
					if (chromeVersion > 31 && document.documentElement.scrollWidth <= window.outerWidth) {
						return true;
					}
				}

			// Chrome desktop doesn't need FastClick (issue #15)
			} else {
				return true;
			}
		}

		if (deviceIsBlackBerry10) {
			blackberryVersion = navigator.userAgent.match(/Version\/([0-9]*)\.([0-9]*)/);

			// BlackBerry 10.3+ does not require Fastclick library.
			// https://github.com/ftlabs/fastclick/issues/251
			if (blackberryVersion[1] >= 10 && blackberryVersion[2] >= 3) {
				metaViewport = document.querySelector('meta[name=viewport]');

				if (metaViewport) {
					// user-scalable=no eliminates click delay.
					if (metaViewport.content.indexOf('user-scalable=no') !== -1) {
						return true;
					}
					// width=device-width (or less than device-width) eliminates click delay.
					if (document.documentElement.scrollWidth <= window.outerWidth) {
						return true;
					}
				}
			}
		}

		// IE10 with -ms-touch-action: none or manipulation, which disables double-tap-to-zoom (issue #97)
		if (layer.style.msTouchAction === 'none' || layer.style.touchAction === 'manipulation') {
			return true;
		}

		// Firefox version - zero for other browsers
		firefoxVersion = +(/Firefox\/([0-9]+)/.exec(navigator.userAgent) || [,0])[1];

		if (firefoxVersion >= 27) {
			// Firefox 27+ does not have tap delay if the content is not zoomable - https://bugzilla.mozilla.org/show_bug.cgi?id=922896

			metaViewport = document.querySelector('meta[name=viewport]');
			if (metaViewport && (metaViewport.content.indexOf('user-scalable=no') !== -1 || document.documentElement.scrollWidth <= window.outerWidth)) {
				return true;
			}
		}

		// IE11: prefixed -ms-touch-action is no longer supported and it's recommended to use non-prefixed version
		// http://msdn.microsoft.com/en-us/library/windows/apps/Hh767313.aspx
		if (layer.style.touchAction === 'none' || layer.style.touchAction === 'manipulation') {
			return true;
		}

		return false;
	};


	/**
	 * Factory method for creating a FastClick object
	 *
	 * @param {Element} layer The layer to listen on
	 * @param {Object} [options={}] The options to override the defaults
	 */
	FastClick.attach = function(layer, options) {
		return new FastClick(layer, options);
	};

  window.FastClick = FastClick;
}());

/**
 * MicroEvent - to make any js object an event emitter (server or browser)
 * 
 * - pure javascript - server compatible, browser compatible
 * - dont rely on the browser doms
 * - super simple - you get it immediately, no mystery, no magic involved
 *
 * - create a MicroEventDebug with goodies to debug
 *   - make it safer to use
*/

/** NOTE: This library is customized for Onsen UI. */

var MicroEvent  = function(){};
MicroEvent.prototype  = {
  on  : function(event, fct){
    this._events = this._events || {};
    this._events[event] = this._events[event] || [];
    this._events[event].push(fct);
  },
  once : function(event, fct){
    var self = this;
    var wrapper = function() {
      self.off(event, wrapper);
      return fct.apply(null, arguments);
    };
    this.on(event, wrapper);
  },
  off  : function(event, fct){
    this._events = this._events || {};
    if( event in this._events === false  )  return;
    this._events[event].splice(this._events[event].indexOf(fct), 1);
  },
  emit : function(event /* , args... */){
    this._events = this._events || {};
    if( event in this._events === false  )  return;
    for(var i = 0; i < this._events[event].length; i++){
      this._events[event][i].apply(this, Array.prototype.slice.call(arguments, 1));
    }
  }
};

/**
 * mixin will delegate all MicroEvent.js function in the destination object
 *
 * - require('MicroEvent').mixin(Foobar) will make Foobar able to use MicroEvent
 *
 * @param {Object} the object which will support MicroEvent
*/
MicroEvent.mixin  = function(destObject){
  var props = ['on', 'once', 'off', 'emit'];
  for(var i = 0; i < props.length; i ++){
    if( typeof destObject === 'function' ){
      destObject.prototype[props[i]]  = MicroEvent.prototype[props[i]];
    }else{
      destObject[props[i]] = MicroEvent.prototype[props[i]];
    }
  }
}

// export in common js
if( typeof module !== "undefined" && ('exports' in module)){
  module.exports  = MicroEvent;
}

window.MicroEvent = MicroEvent;

/*! modernizr 3.1.0 (Custom Build) | MIT *
 * http://modernizr.com/download/?-borderradius-boxshadow-canvas-cssanimations-csstransforms-csstransforms3d-csstransitions-svg-addtest-domprefixes-prefixes-shiv-testallprops-testprop-teststyles !*/
!function(e,t,n){function r(e,t){return typeof e===t}function o(){var e,t,n,o,i,s,a;for(var l in S)if(S.hasOwnProperty(l)){if(e=[],t=S[l],t.name&&(e.push(t.name.toLowerCase()),t.options&&t.options.aliases&&t.options.aliases.length))for(n=0;n<t.options.aliases.length;n++)e.push(t.options.aliases[n].toLowerCase());for(o=r(t.fn,"function")?t.fn():t.fn,i=0;i<e.length;i++)s=e[i],a=s.split("."),1===a.length?Modernizr[a[0]]=o:(!Modernizr[a[0]]||Modernizr[a[0]]instanceof Boolean||(Modernizr[a[0]]=new Boolean(Modernizr[a[0]])),Modernizr[a[0]][a[1]]=o),C.push((o?"":"no-")+a.join("-"))}}function i(e){var t=w.className,n=Modernizr._config.classPrefix||"";if(_&&(t=t.baseVal),Modernizr._config.enableJSClass){var r=new RegExp("(^|\\s)"+n+"no-js(\\s|$)");t=t.replace(r,"$1"+n+"js$2")}Modernizr._config.enableClasses&&(t+=" "+n+e.join(" "+n),_?w.className.baseVal=t:w.className=t)}function s(e,t){if("object"==typeof e)for(var n in e)N(e,n)&&s(n,e[n]);else{e=e.toLowerCase();var r=e.split("."),o=Modernizr[r[0]];if(2==r.length&&(o=o[r[1]]),"undefined"!=typeof o)return Modernizr;t="function"==typeof t?t():t,1==r.length?Modernizr[r[0]]=t:(!Modernizr[r[0]]||Modernizr[r[0]]instanceof Boolean||(Modernizr[r[0]]=new Boolean(Modernizr[r[0]])),Modernizr[r[0]][r[1]]=t),i([(t&&0!=t?"":"no-")+r.join("-")]),Modernizr._trigger(e,t)}return Modernizr}function a(){return"function"!=typeof t.createElement?t.createElement(arguments[0]):_?t.createElementNS.call(t,"http://www.w3.org/2000/svg",arguments[0]):t.createElement.apply(t,arguments)}function l(e,t){return!!~(""+e).indexOf(t)}function u(){var e=t.body;return e||(e=a(_?"svg":"body"),e.fake=!0),e}function f(e,n,r,o){var i,s,l,f,c="modernizr",d=a("div"),p=u();if(parseInt(r,10))for(;r--;)l=a("div"),l.id=o?o[r]:c+(r+1),d.appendChild(l);return i=a("style"),i.type="text/css",i.id="s"+c,(p.fake?p:d).appendChild(i),p.appendChild(d),i.styleSheet?i.styleSheet.cssText=e:i.appendChild(t.createTextNode(e)),d.id=c,p.fake&&(p.style.background="",p.style.overflow="hidden",f=w.style.overflow,w.style.overflow="hidden",w.appendChild(p)),s=n(d,e),p.fake?(p.parentNode.removeChild(p),w.style.overflow=f,w.offsetHeight):d.parentNode.removeChild(d),!!s}function c(e){return e.replace(/([a-z])-([a-z])/g,function(e,t,n){return t+n.toUpperCase()}).replace(/^-/,"")}function d(e,t){return function(){return e.apply(t,arguments)}}function p(e,t,n){var o;for(var i in e)if(e[i]in t)return n===!1?e[i]:(o=t[e[i]],r(o,"function")?d(o,n||t):o);return!1}function m(e){return e.replace(/([A-Z])/g,function(e,t){return"-"+t.toLowerCase()}).replace(/^ms-/,"-ms-")}function h(t,r){var o=t.length;if("CSS"in e&&"supports"in e.CSS){for(;o--;)if(e.CSS.supports(m(t[o]),r))return!0;return!1}if("CSSSupportsRule"in e){for(var i=[];o--;)i.push("("+m(t[o])+":"+r+")");return i=i.join(" or "),f("@supports ("+i+") { #modernizr { position: absolute; } }",function(e){return"absolute"==getComputedStyle(e,null).position})}return n}function g(e,t,o,i){function s(){f&&(delete L.style,delete L.modElem)}if(i=r(i,"undefined")?!1:i,!r(o,"undefined")){var u=h(e,o);if(!r(u,"undefined"))return u}for(var f,d,p,m,g,v=["modernizr","tspan"];!L.style;)f=!0,L.modElem=a(v.shift()),L.style=L.modElem.style;for(p=e.length,d=0;p>d;d++)if(m=e[d],g=L.style[m],l(m,"-")&&(m=c(m)),L.style[m]!==n){if(i||r(o,"undefined"))return s(),"pfx"==t?m:!0;try{L.style[m]=o}catch(y){}if(L.style[m]!=g)return s(),"pfx"==t?m:!0}return s(),!1}function v(e,t,n,o,i){var s=e.charAt(0).toUpperCase()+e.slice(1),a=(e+" "+k.join(s+" ")+s).split(" ");return r(t,"string")||r(t,"undefined")?g(a,t,o,i):(a=(e+" "+T.join(s+" ")+s).split(" "),p(a,t,n))}function y(e,t,r){return v(e,n,n,t,r)}var C=[],S=[],x={_version:"3.1.0",_config:{classPrefix:"",enableClasses:!0,enableJSClass:!0,usePrefixes:!0},_q:[],on:function(e,t){var n=this;setTimeout(function(){t(n[e])},0)},addTest:function(e,t,n){S.push({name:e,fn:t,options:n})},addAsyncTest:function(e){S.push({name:null,fn:e})}},Modernizr=function(){};Modernizr.prototype=x,Modernizr=new Modernizr,Modernizr.addTest("svg",!!t.createElementNS&&!!t.createElementNS("http://www.w3.org/2000/svg","svg").createSVGRect);var b=x._config.usePrefixes?" -webkit- -moz- -o- -ms- ".split(" "):[];x._prefixes=b;var w=t.documentElement,_="svg"===w.nodeName.toLowerCase();_||!function(e,t){function n(e,t){var n=e.createElement("p"),r=e.getElementsByTagName("head")[0]||e.documentElement;return n.innerHTML="x<style>"+t+"</style>",r.insertBefore(n.lastChild,r.firstChild)}function r(){var e=C.elements;return"string"==typeof e?e.split(" "):e}function o(e,t){var n=C.elements;"string"!=typeof n&&(n=n.join(" ")),"string"!=typeof e&&(e=e.join(" ")),C.elements=n+" "+e,u(t)}function i(e){var t=y[e[g]];return t||(t={},v++,e[g]=v,y[v]=t),t}function s(e,n,r){if(n||(n=t),c)return n.createElement(e);r||(r=i(n));var o;return o=r.cache[e]?r.cache[e].cloneNode():h.test(e)?(r.cache[e]=r.createElem(e)).cloneNode():r.createElem(e),!o.canHaveChildren||m.test(e)||o.tagUrn?o:r.frag.appendChild(o)}function a(e,n){if(e||(e=t),c)return e.createDocumentFragment();n=n||i(e);for(var o=n.frag.cloneNode(),s=0,a=r(),l=a.length;l>s;s++)o.createElement(a[s]);return o}function l(e,t){t.cache||(t.cache={},t.createElem=e.createElement,t.createFrag=e.createDocumentFragment,t.frag=t.createFrag()),e.createElement=function(n){return C.shivMethods?s(n,e,t):t.createElem(n)},e.createDocumentFragment=Function("h,f","return function(){var n=f.cloneNode(),c=n.createElement;h.shivMethods&&("+r().join().replace(/[\w\-:]+/g,function(e){return t.createElem(e),t.frag.createElement(e),'c("'+e+'")'})+");return n}")(C,t.frag)}function u(e){e||(e=t);var r=i(e);return!C.shivCSS||f||r.hasCSS||(r.hasCSS=!!n(e,"article,aside,dialog,figcaption,figure,footer,header,hgroup,main,nav,section{display:block}mark{background:#FF0;color:#000}template{display:none}")),c||l(e,r),e}var f,c,d="3.7.3",p=e.html5||{},m=/^<|^(?:button|map|select|textarea|object|iframe|option|optgroup)$/i,h=/^(?:a|b|code|div|fieldset|h1|h2|h3|h4|h5|h6|i|label|li|ol|p|q|span|strong|style|table|tbody|td|th|tr|ul)$/i,g="_html5shiv",v=0,y={};!function(){try{var e=t.createElement("a");e.innerHTML="<xyz></xyz>",f="hidden"in e,c=1==e.childNodes.length||function(){t.createElement("a");var e=t.createDocumentFragment();return"undefined"==typeof e.cloneNode||"undefined"==typeof e.createDocumentFragment||"undefined"==typeof e.createElement}()}catch(n){f=!0,c=!0}}();var C={elements:p.elements||"abbr article aside audio bdi canvas data datalist details dialog figcaption figure footer header hgroup main mark meter nav output picture progress section summary template time video",version:d,shivCSS:p.shivCSS!==!1,supportsUnknownElements:c,shivMethods:p.shivMethods!==!1,type:"default",shivDocument:u,createElement:s,createDocumentFragment:a,addElements:o};e.html5=C,u(t),"object"==typeof module&&module.exports&&(module.exports=C)}("undefined"!=typeof e?e:this,t);var E="Moz O ms Webkit",T=x._config.usePrefixes?E.toLowerCase().split(" "):[];x._domPrefixes=T;var N;!function(){var e={}.hasOwnProperty;N=r(e,"undefined")||r(e.call,"undefined")?function(e,t){return t in e&&r(e.constructor.prototype[t],"undefined")}:function(t,n){return e.call(t,n)}}(),x._l={},x.on=function(e,t){this._l[e]||(this._l[e]=[]),this._l[e].push(t),Modernizr.hasOwnProperty(e)&&setTimeout(function(){Modernizr._trigger(e,Modernizr[e])},0)},x._trigger=function(e,t){if(this._l[e]){var n=this._l[e];setTimeout(function(){var e,r;for(e=0;e<n.length;e++)(r=n[e])(t)},0),delete this._l[e]}},Modernizr._q.push(function(){x.addTest=s}),Modernizr.addTest("canvas",function(){var e=a("canvas");return!(!e.getContext||!e.getContext("2d"))});var P="CSS"in e&&"supports"in e.CSS,j="supportsCSS"in e;Modernizr.addTest("supports",P||j);var k=x._config.usePrefixes?E.split(" "):[];x._cssomPrefixes=k;var z=x.testStyles=f,F={elem:a("modernizr")};Modernizr._q.push(function(){delete F.elem});var L={style:F.elem.style};Modernizr._q.unshift(function(){delete L.style});x.testProp=function(e,t,r){return g([e],n,t,r)};x.testAllProps=v,x.testAllProps=y,Modernizr.addTest("borderradius",y("borderRadius","0px",!0)),Modernizr.addTest("boxshadow",y("boxShadow","1px 1px",!0)),Modernizr.addTest("cssanimations",y("animationName","a",!0)),Modernizr.addTest("csstransforms",function(){return-1===navigator.userAgent.indexOf("Android 2.")&&y("transform","scale(1)",!0)}),Modernizr.addTest("csstransforms3d",function(){var e=!!y("perspective","1px",!0),t=Modernizr._config.usePrefixes;if(e&&(!t||"webkitPerspective"in w.style)){var n;Modernizr.supports?n="@supports (perspective: 1px)":(n="@media (transform-3d)",t&&(n+=",(-webkit-transform-3d)")),n+="{#modernizr{left:9px;position:absolute;height:5px;margin:0;padding:0;border:0}}",z(n,function(t){e=9===t.offsetLeft&&5===t.offsetHeight})}return e}),Modernizr.addTest("csstransitions",y("transition","all",!0)),o(),i(C),delete x.addTest,delete x.addAsyncTest;for(var A=0;A<Modernizr._q.length;A++)Modernizr._q[A]();e.Modernizr=Modernizr}(window,document);
!function n(t,e,r){function o(u,f){if(!e[u]){if(!t[u]){var c="function"==typeof require&&require;if(!f&&c)return c(u,!0);if(i)return i(u,!0);var s=new Error("Cannot find module '"+u+"'");throw s.code="MODULE_NOT_FOUND",s}var l=e[u]={exports:{}};t[u][0].call(l.exports,function(n){var e=t[u][1][n];return o(e?e:n)},l,l.exports,n,t,e,r)}return e[u].exports}for(var i="function"==typeof require&&require,u=0;u<r.length;u++)o(r[u]);return o}({1:[function(n,t,e){"use strict";function r(){}function o(n){try{return n.then}catch(t){return d=t,w}}function i(n,t){try{return n(t)}catch(e){return d=e,w}}function u(n,t,e){try{n(t,e)}catch(r){return d=r,w}}function f(n){if("object"!=typeof this)throw new TypeError("Promises must be constructed via new");if("function"!=typeof n)throw new TypeError("not a function");this._37=0,this._12=null,this._59=[],n!==r&&v(n,this)}function c(n,t,e){return new n.constructor(function(o,i){var u=new f(r);u.then(o,i),s(n,new p(t,e,u))})}function s(n,t){for(;3===n._37;)n=n._12;return 0===n._37?void n._59.push(t):void y(function(){var e=1===n._37?t.onFulfilled:t.onRejected;if(null===e)return void(1===n._37?l(t.promise,n._12):a(t.promise,n._12));var r=i(e,n._12);r===w?a(t.promise,d):l(t.promise,r)})}function l(n,t){if(t===n)return a(n,new TypeError("A promise cannot be resolved with itself."));if(t&&("object"==typeof t||"function"==typeof t)){var e=o(t);if(e===w)return a(n,d);if(e===n.then&&t instanceof f)return n._37=3,n._12=t,void h(n);if("function"==typeof e)return void v(e.bind(t),n)}n._37=1,n._12=t,h(n)}function a(n,t){n._37=2,n._12=t,h(n)}function h(n){for(var t=0;t<n._59.length;t++)s(n,n._59[t]);n._59=null}function p(n,t,e){this.onFulfilled="function"==typeof n?n:null,this.onRejected="function"==typeof t?t:null,this.promise=e}function v(n,t){var e=!1,r=u(n,function(n){e||(e=!0,l(t,n))},function(n){e||(e=!0,a(t,n))});e||r!==w||(e=!0,a(t,d))}var y=n("asap/raw"),d=null,w={};t.exports=f,f._99=r,f.prototype.then=function(n,t){if(this.constructor!==f)return c(this,n,t);var e=new f(r);return s(this,new p(n,t,e)),e}},{"asap/raw":4}],2:[function(n,t,e){"use strict";function r(n){var t=new o(o._99);return t._37=1,t._12=n,t}var o=n("./core.js");t.exports=o;var i=r(!0),u=r(!1),f=r(null),c=r(void 0),s=r(0),l=r("");o.resolve=function(n){if(n instanceof o)return n;if(null===n)return f;if(void 0===n)return c;if(n===!0)return i;if(n===!1)return u;if(0===n)return s;if(""===n)return l;if("object"==typeof n||"function"==typeof n)try{var t=n.then;if("function"==typeof t)return new o(t.bind(n))}catch(e){return new o(function(n,t){t(e)})}return r(n)},o.all=function(n){var t=Array.prototype.slice.call(n);return new o(function(n,e){function r(u,f){if(f&&("object"==typeof f||"function"==typeof f)){if(f instanceof o&&f.then===o.prototype.then){for(;3===f._37;)f=f._12;return 1===f._37?r(u,f._12):(2===f._37&&e(f._12),void f.then(function(n){r(u,n)},e))}var c=f.then;if("function"==typeof c){var s=new o(c.bind(f));return void s.then(function(n){r(u,n)},e)}}t[u]=f,0===--i&&n(t)}if(0===t.length)return n([]);for(var i=t.length,u=0;u<t.length;u++)r(u,t[u])})},o.reject=function(n){return new o(function(t,e){e(n)})},o.race=function(n){return new o(function(t,e){n.forEach(function(n){o.resolve(n).then(t,e)})})},o.prototype["catch"]=function(n){return this.then(null,n)}},{"./core.js":1}],3:[function(n,t,e){"use strict";function r(){if(c.length)throw c.shift()}function o(n){var t;t=f.length?f.pop():new i,t.task=n,u(t)}function i(){this.task=null}var u=n("./raw"),f=[],c=[],s=u.makeRequestCallFromTimer(r);t.exports=o,i.prototype.call=function(){try{this.task.call()}catch(n){o.onerror?o.onerror(n):(c.push(n),s())}finally{this.task=null,f[f.length]=this}}},{"./raw":4}],4:[function(n,t,e){(function(n){"use strict";function e(n){f.length||(u(),c=!0),f[f.length]=n}function r(){for(;s<f.length;){var n=s;if(s+=1,f[n].call(),s>l){for(var t=0,e=f.length-s;e>t;t++)f[t]=f[t+s];f.length-=s,s=0}}f.length=0,s=0,c=!1}function o(n){var t=1,e=new a(n),r=document.createTextNode("");return e.observe(r,{characterData:!0}),function(){t=-t,r.data=t}}function i(n){return function(){function t(){clearTimeout(e),clearInterval(r),n()}var e=setTimeout(t,0),r=setInterval(t,50)}}t.exports=e;var u,f=[],c=!1,s=0,l=1024,a=n.MutationObserver||n.WebKitMutationObserver;u="function"==typeof a?o(r):i(r),e.requestFlush=u,e.makeRequestCallFromTimer=i}).call(this,"undefined"!=typeof global?global:"undefined"!=typeof self?self:"undefined"!=typeof window?window:{})},{}],5:[function(n,t,e){"function"!=typeof Promise.prototype.done&&(Promise.prototype.done=function(n,t){var e=arguments.length?this.then.apply(this,arguments):this;e.then(null,function(n){setTimeout(function(){throw n},0)})})},{}],6:[function(n,t,e){n("asap");"undefined"==typeof Promise&&(Promise=n("./lib/core.js"),n("./lib/es6-extensions.js")),n("./polyfill-done.js")},{"./lib/core.js":1,"./lib/es6-extensions.js":2,"./polyfill-done.js":5,asap:3}]},{},[6]);

/*
Copyright (c) 2012 Barnesandnoble.com, llc, Donavon West, and Domenic Denicola

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

*/
(function (global, undefined) {
    "use strict";

    if (global.setImmediate) {
        return;
    }

    var nextHandle = 1; // Spec says greater than zero
    var tasksByHandle = {};
    var currentlyRunningATask = false;
    var doc = global.document;
    var setImmediate;

    function addFromSetImmediateArguments(args) {
        tasksByHandle[nextHandle] = partiallyApplied.apply(undefined, args);
        return nextHandle++;
    }

    // This function accepts the same arguments as setImmediate, but
    // returns a function that requires no arguments.
    function partiallyApplied(handler) {
        var args = [].slice.call(arguments, 1);
        return function() {
            if (typeof handler === "function") {
                handler.apply(undefined, args);
            } else {
                (new Function("" + handler))();
            }
        };
    }

    function runIfPresent(handle) {
        // From the spec: "Wait until any invocations of this algorithm started before this one have completed."
        // So if we're currently running a task, we'll need to delay this invocation.
        if (currentlyRunningATask) {
            // Delay by doing a setTimeout. setImmediate was tried instead, but in Firefox 7 it generated a
            // "too much recursion" error.
            setTimeout(partiallyApplied(runIfPresent, handle), 0);
        } else {
            var task = tasksByHandle[handle];
            if (task) {
                currentlyRunningATask = true;
                try {
                    task();
                } finally {
                    clearImmediate(handle);
                    currentlyRunningATask = false;
                }
            }
        }
    }

    function clearImmediate(handle) {
        delete tasksByHandle[handle];
    }

    function installNextTickImplementation() {
        setImmediate = function() {
            var handle = addFromSetImmediateArguments(arguments);
            process.nextTick(partiallyApplied(runIfPresent, handle));
            return handle;
        };
    }

    function canUsePostMessage() {
        // The test against `importScripts` prevents this implementation from being installed inside a web worker,
        // where `global.postMessage` means something completely different and can't be used for this purpose.
        if (global.postMessage && !global.importScripts) {
            var postMessageIsAsynchronous = true;
            var oldOnMessage = global.onmessage;
            global.onmessage = function() {
                postMessageIsAsynchronous = false;
            };
            global.postMessage("", "*");
            global.onmessage = oldOnMessage;
            return postMessageIsAsynchronous;
        }
    }

    function installPostMessageImplementation() {
        // Installs an event handler on `global` for the `message` event: see
        // * https://developer.mozilla.org/en/DOM/window.postMessage
        // * http://www.whatwg.org/specs/web-apps/current-work/multipage/comms.html#crossDocumentMessages

        var messagePrefix = "setImmediate$" + Math.random() + "$";
        var onGlobalMessage = function(event) {
            if (event.source === global &&
                typeof event.data === "string" &&
                event.data.indexOf(messagePrefix) === 0) {
                runIfPresent(+event.data.slice(messagePrefix.length));
            }
        };

        if (global.addEventListener) {
            global.addEventListener("message", onGlobalMessage, false);
        } else {
            global.attachEvent("onmessage", onGlobalMessage);
        }

        setImmediate = function() {
            var handle = addFromSetImmediateArguments(arguments);
            global.postMessage(messagePrefix + handle, "*");
            return handle;
        };
    }

    function installMessageChannelImplementation() {
        var channel = new MessageChannel();
        channel.port1.onmessage = function(event) {
            var handle = event.data;
            runIfPresent(handle);
        };

        setImmediate = function() {
            var handle = addFromSetImmediateArguments(arguments);
            channel.port2.postMessage(handle);
            return handle;
        };
    }

    function installReadyStateChangeImplementation() {
        var html = doc.documentElement;
        setImmediate = function() {
            var handle = addFromSetImmediateArguments(arguments);
            // Create a <script> element; its readystatechange event will be fired asynchronously once it is inserted
            // into the document. Do so, thus queuing up the task. Remember to clean up once it's been called.
            var script = doc.createElement("script");
            script.onreadystatechange = function () {
                runIfPresent(handle);
                script.onreadystatechange = null;
                html.removeChild(script);
                script = null;
            };
            html.appendChild(script);
            return handle;
        };
    }

    function installSetTimeoutImplementation() {
        setImmediate = function() {
            var handle = addFromSetImmediateArguments(arguments);
            setTimeout(partiallyApplied(runIfPresent, handle), 0);
            return handle;
        };
    }

    // If supported, we should attach to the prototype of global, since that is where setTimeout et al. live.
    var attachTo = Object.getPrototypeOf && Object.getPrototypeOf(global);
    attachTo = attachTo && attachTo.setTimeout ? attachTo : global;

    // Don't get fooled by e.g. browserify environments.
    if ({}.toString.call(global.process) === "[object process]") {
        // For Node.js before 0.9
        installNextTickImplementation();

    } else if (canUsePostMessage()) {
        // For non-IE10 modern browsers
        installPostMessageImplementation();

    } else if (global.MessageChannel) {
        // For web workers, where supported
        installMessageChannelImplementation();

    } else if (doc && "onreadystatechange" in doc.createElement("script")) {
        // For IE 6–8
        installReadyStateChangeImplementation();

    } else {
        // For older browsers
        installSetTimeoutImplementation();
    }

    attachTo.setImmediate = setImmediate;
    attachTo.clearImmediate = clearImmediate;
}(function() {return this;}()));

(function() {
    function Viewport() {

        this.PRE_IOS7_VIEWPORT = "initial-scale=1, maximum-scale=1, user-scalable=no";
        this.IOS7_VIEWPORT = "initial-scale=1, maximum-scale=1, user-scalable=no";
        this.DEFAULT_VIEWPORT = "initial-scale=1, maximum-scale=1, user-scalable=no";

        this.ensureViewportElement();
        this.platform = {};
        this.platform.name = this.getPlatformName();
        this.platform.version = this.getPlatformVersion();

        return this;
    };

    Viewport.prototype.ensureViewportElement = function(){
        this.viewportElement = document.querySelector('meta[name=viewport]');
        if(!this.viewportElement){
            this.viewportElement = document.createElement('meta');
            this.viewportElement.name = "viewport";
            document.head.appendChild(this.viewportElement);
        }
    },

    Viewport.prototype.setup = function() {
        if (!this.viewportElement) {
            return;
        }

        if (this.viewportElement.getAttribute('data-no-adjust') == "true") {
            return;
        }

        if (this.platform.name == 'ios') {
            if (this.platform.version >= 7 && isWebView()) {
                this.viewportElement.setAttribute('content', this.IOS7_VIEWPORT);
            } else {
                this.viewportElement.setAttribute('content', this.PRE_IOS7_VIEWPORT);
            }
        } else {
            this.viewportElement.setAttribute('content', this.DEFAULT_VIEWPORT);
        }

        function isWebView() {
            return !!(window.cordova || window.phonegap || window.PhoneGap);
        }
    };

    Viewport.prototype.getPlatformName = function() {
        if (navigator.userAgent.match(/Android/i)) {
            return "android";
        }

        if (navigator.userAgent.match(/iPhone|iPad|iPod/i)) {
            return "ios";
        }

        // unknown
        return undefined;
    };

    Viewport.prototype.getPlatformVersion = function() {
        var start = window.navigator.userAgent.indexOf('OS ');
        return window.Number(window.navigator.userAgent.substr(start + 3, 3).replace('_', '.'));
    };

    window.Viewport = Viewport;
})();

// Copyright (c) Microsoft Open Technologies, Inc.  All rights reserved.  Licensed under the Apache License, Version 2.0.  See License.txt in the project root for license information.
// JavaScript Dynamic Content shim for Windows Store apps
(function () {

    if (window.MSApp && MSApp.execUnsafeLocalFunction) {

        // Some nodes will have an "attributes" property which shadows the Node.prototype.attributes property
        //  and means we don't actually see the attributes of the Node (interestingly the VS debug console
        //  appears to suffer from the same issue).
        //
        var Element_setAttribute = Object.getOwnPropertyDescriptor(Element.prototype, "setAttribute").value;
        var Element_removeAttribute = Object.getOwnPropertyDescriptor(Element.prototype, "removeAttribute").value;
        var HTMLElement_insertAdjacentHTMLPropertyDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "insertAdjacentHTML");
        var Node_get_attributes = Object.getOwnPropertyDescriptor(Node.prototype, "attributes").get;
        var Node_get_childNodes = Object.getOwnPropertyDescriptor(Node.prototype, "childNodes").get;
        var detectionDiv = document.createElement("div");

        function getAttributes(element) {
            return Node_get_attributes.call(element);
        }

        function setAttribute(element, attribute, value) {
            try {
                Element_setAttribute.call(element, attribute, value);
            } catch (e) {
                // ignore
            }
        }

        function removeAttribute(element, attribute) {
            Element_removeAttribute.call(element, attribute);
        }

        function childNodes(element) {
            return Node_get_childNodes.call(element);
        }

        function empty(element) {
            while (element.childNodes.length) {
                element.removeChild(element.lastChild);
            }
        }

        function insertAdjacentHTML(element, position, html) {
            HTMLElement_insertAdjacentHTMLPropertyDescriptor.value.call(element, position, html);
        }

        function inUnsafeMode() {
            var isUnsafe = true;
            try {
                detectionDiv.innerHTML = "<test/>";
            }
            catch (ex) {
                isUnsafe = false;
            }

            return isUnsafe;
        }

        function cleanse(html, targetElement) {
            var cleaner = document.implementation.createHTMLDocument("cleaner");
            empty(cleaner.documentElement);
            MSApp.execUnsafeLocalFunction(function () {
                insertAdjacentHTML(cleaner.documentElement, "afterbegin", html);
            });

            var scripts = cleaner.documentElement.querySelectorAll("script");
            Array.prototype.forEach.call(scripts, function (script) {
                switch (script.type.toLowerCase()) {
                    case "":
                        script.type = "text/inert";
                        break;
                    case "text/javascript":
                    case "text/ecmascript":
                    case "text/x-javascript":
                    case "text/jscript":
                    case "text/livescript":
                    case "text/javascript1.1":
                    case "text/javascript1.2":
                    case "text/javascript1.3":
                        script.type = "text/inert-" + script.type.slice("text/".length);
                        break;
                    case "application/javascript":
                    case "application/ecmascript":
                    case "application/x-javascript":
                        script.type = "application/inert-" + script.type.slice("application/".length);
                        break;

                    default:
                        break;
                }
            });

            function cleanseAttributes(element) {
                var attributes = getAttributes(element);
                if (attributes && attributes.length) {
                    // because the attributes collection is live it is simpler to queue up the renames
                    var events;
                    for (var i = 0, len = attributes.length; i < len; i++) {
                        var attribute = attributes[i];
                        var name = attribute.name;
                        if ((name[0] === "o" || name[0] === "O") &&
                            (name[1] === "n" || name[1] === "N")) {
                            events = events || [];
                            events.push({ name: attribute.name, value: attribute.value });
                        }
                    }
                    if (events) {
                        for (var i = 0, len = events.length; i < len; i++) {
                            var attribute = events[i];
                            removeAttribute(element, attribute.name);
                            setAttribute(element, "x-" + attribute.name, attribute.value);
                        }
                    }
                }
                var children = childNodes(element);
                for (var i = 0, len = children.length; i < len; i++) {
                    cleanseAttributes(children[i]);
                }
            }
            cleanseAttributes(cleaner.documentElement);

            var cleanedNodes = [];

            if (targetElement.tagName === 'HTML') {
                cleanedNodes = Array.prototype.slice.call(document.adoptNode(cleaner.documentElement).childNodes);
            } else {
                if (cleaner.head) {
                    cleanedNodes = cleanedNodes.concat(Array.prototype.slice.call(document.adoptNode(cleaner.head).childNodes));
                }
                if (cleaner.body) {
                    cleanedNodes = cleanedNodes.concat(Array.prototype.slice.call(document.adoptNode(cleaner.body).childNodes));
                }
            }

            return cleanedNodes;
        }

        function cleansePropertySetter(property, setter) {
            var propertyDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, property);
            var originalSetter = propertyDescriptor.set;
            Object.defineProperty(HTMLElement.prototype, property, {
                get: propertyDescriptor.get,
                set: function (value) {
                    if(window.WinJS && window.WinJS._execUnsafe && inUnsafeMode()) {
                        originalSetter.call(this, value);
                    } else {
                        var that = this;
                        var nodes = cleanse(value, that);
                        MSApp.execUnsafeLocalFunction(function () {
                            setter(propertyDescriptor, that, nodes);
                        });
                    }
                },
                enumerable: propertyDescriptor.enumerable,
                configurable: propertyDescriptor.configurable,
            });
        }
        cleansePropertySetter("innerHTML", function (propertyDescriptor, target, elements) {
            empty(target);
            for (var i = 0, len = elements.length; i < len; i++) {
                target.appendChild(elements[i]);
            }
        });
        cleansePropertySetter("outerHTML", function (propertyDescriptor, target, elements) {
            for (var i = 0, len = elements.length; i < len; i++) {
                target.insertAdjacentElement("afterend", elements[i]);
            }
            target.parentNode.removeChild(target);
        });

    }

}());
(function (global, factory) {
   typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
   typeof define === 'function' && define.amd ? define(factory) :
   (global.ons = factory());
}(this, function () { 'use strict';

   var babelHelpers = {};

   babelHelpers.typeof = function (obj) {
     return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj;
   };

   babelHelpers.classCallCheck = function (instance, Constructor) {
     if (!(instance instanceof Constructor)) {
       throw new TypeError("Cannot call a class as a function");
     }
   };

   babelHelpers.createClass = (function () {
     function defineProperties(target, props) {
       for (var i = 0; i < props.length; i++) {
         var descriptor = props[i];
         descriptor.enumerable = descriptor.enumerable || false;
         descriptor.configurable = true;
         if ("value" in descriptor) descriptor.writable = true;
         Object.defineProperty(target, descriptor.key, descriptor);
       }
     }

     return function (Constructor, protoProps, staticProps) {
       if (protoProps) defineProperties(Constructor.prototype, protoProps);
       if (staticProps) defineProperties(Constructor, staticProps);
       return Constructor;
     };
   })();

   babelHelpers.inherits = function (subClass, superClass) {
     if (typeof superClass !== "function" && superClass !== null) {
       throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
     }

     subClass.prototype = Object.create(superClass && superClass.prototype, {
       constructor: {
         value: subClass,
         enumerable: false,
         writable: true,
         configurable: true
       }
     });
     if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
   };

   babelHelpers.possibleConstructorReturn = function (self, call) {
     if (!self) {
       throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
     }

     return call && (typeof call === "object" || typeof call === "function") ? call : self;
   };

   babelHelpers.slicedToArray = (function () {
     function sliceIterator(arr, i) {
       var _arr = [];
       var _n = true;
       var _d = false;
       var _e = undefined;

       try {
         for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {
           _arr.push(_s.value);

           if (i && _arr.length === i) break;
         }
       } catch (err) {
         _d = true;
         _e = err;
       } finally {
         try {
           if (!_n && _i["return"]) _i["return"]();
         } finally {
           if (_d) throw _e;
         }
       }

       return _arr;
     }

     return function (arr, i) {
       if (Array.isArray(arr)) {
         return arr;
       } else if (Symbol.iterator in Object(arr)) {
         return sliceIterator(arr, i);
       } else {
         throw new TypeError("Invalid attempt to destructure non-iterable instance");
       }
     };
   })();

   babelHelpers;

   var unwrap = function unwrap(string) {
     return string.slice(1, -1);
   };
   var isObjectString = function isObjectString(string) {
     return string.startsWith('{') && string.endsWith('}');
   };
   var isArrayString = function isArrayString(string) {
     return string.startsWith('[') && string.endsWith(']');
   };
   var isQuotedString = function isQuotedString(string) {
     return string.startsWith('\'') && string.endsWith('\'') || string.startsWith('"') && string.endsWith('"');
   };

   var error = function error(token, string, originalString) {
     throw new Error('Unexpected token \'' + token + '\' at position ' + (originalString.length - string.length - 1) + ' in string: \'' + originalString + '\'');
   };

   var processToken = function processToken(token, string, originalString) {
     if (token === 'true' || token === 'false') {
       return token === 'true';
     } else if (isQuotedString(token)) {
       return unwrap(token);
     } else if (!isNaN(token)) {
       return +token;
     } else if (isObjectString(token)) {
       return parseObject(unwrap(token));
     } else if (isArrayString(token)) {
       return parseArray(unwrap(token));
     } else {
       error(token, string, originalString);
     }
   };

   var nextToken = function nextToken(string) {
     string = string.trimLeft();
     var limit = string.length;

     if (string[0] === ':' || string[0] === ',') {

       limit = 1;
     } else if (string[0] === '{' || string[0] === '[') {

       var c = string.charCodeAt(0);
       var nestedObject = 1;
       for (var i = 1; i < string.length; i++) {
         if (string.charCodeAt(i) === c) {
           nestedObject++;
         } else if (string.charCodeAt(i) === c + 2) {
           nestedObject--;
           if (nestedObject === 0) {
             limit = i + 1;
             break;
           }
         }
       }
     } else if (string[0] === '\'' || string[0] === '\"') {

       for (var i = 1; i < string.length; i++) {
         if (string[i] === string[0]) {
           limit = i + 1;
           break;
         }
       }
     } else {

       for (var i = 1; i < string.length; i++) {
         if ([' ', ',', ':'].indexOf(string[i]) !== -1) {
           limit = i;
           break;
         }
       }
     }

     return string.slice(0, limit);
   };

   var parseObject = function parseObject(string) {
     var isValidKey = function isValidKey(key) {
       return (/^[A-Z_\$][A-Z0-9_\$]*$/i.test(key)
       );
     };

     string = string.trim();
     var originalString = string,
         readingKey = true,
         key = undefined,
         previousToken = undefined,
         token = undefined,
         object = {};

     while (string.length > 0) {
       previousToken = token;
       token = nextToken(string);
       string = string.slice(token.length, string.length).trimLeft();

       if (token === ':' && (!readingKey || !previousToken || previousToken === ',') || token === ',' && readingKey || token !== ':' && token !== ',' && previousToken && previousToken !== ',' && previousToken !== ':') {
         error(token, string, originalString);
       } else if (token === ':' && readingKey && previousToken) {
         if (isValidKey(previousToken)) {
           key = previousToken;
           readingKey = false;
         } else {
           throw new Error('Invalid key token \'' + previousToken + '\' at position 0 in string: \'' + originalString + '\'');
         }
       } else if (token === ',' && !readingKey && previousToken) {
         object[key] = processToken(previousToken, string, originalString);
         readingKey = true;
       }
     }

     if (token) {
       object[key] = processToken(token, string, originalString);
     }

     return object;
   };

   var parseArray = function parseArray(string) {
     string = string.trim();
     var originalString = string,
         previousToken = undefined,
         token = undefined,
         array = [];

     while (string.length > 0) {
       previousToken = token;
       token = nextToken(string);
       string = string.slice(token.length, string.length).trimLeft();

       if (token === ',' && (!previousToken || previousToken === ',')) {
         error(token, string, originalString);
       } else if (token === ',') {
         array.push(processToken(previousToken, string, originalString));
       }
     }

     if (token) {
       if (token !== ',') {
         array.push(processToken(token, string, originalString));
       } else {
         error(token, string, originalString);
       }
     }

     return array;
   };

   var parse = function parse(string) {
     string = string.trim();

     if (isObjectString(string)) {
       return parseObject(unwrap(string));
     } else if (isArrayString(string)) {
       return parseArray(unwrap(string));
     } else {
       throw new Error('Provided string must be object or array like: ' + string);
     }
   };

   var util = {};

   /**
    * @param {String/Function} query dot class name or node name or matcher function.
    * @return {Function}
    */
   util.prepareQuery = function (query) {
     return query instanceof Function ? query : query.substr(0, 1) === '.' ? function (node) {
       return node.classList.contains(query.substr(1));
     } : function (node) {
       return node.nodeName.toLowerCase() === query;
     };
   };

   /**
    * @param {Element} element
    * @param {String/Function} query dot class name or node name or matcher function.
    * @return {HTMLElement/null}
    */
   util.findChild = function (element, query) {
     var match = util.prepareQuery(query);

     for (var i = 0; i < element.children.length; i++) {
       var node = element.children[i];
       if (match(node)) {
         return node;
       }
     }
     return null;
   };

   /**
    * @param {Element} element
    * @param {String/Function} query dot class name or node name or matcher function.
    * @return {HTMLElement/null}
    */
   util.findChildRecursively = function (element, query) {
     var match = util.prepareQuery(query);

     for (var i = 0; i < element.children.length; i++) {
       var node = element.children[i];
       if (match(node)) {
         return node;
       } else {
         var nodeMatch = util.findChildRecursively(node, match);
         if (nodeMatch) {
           return nodeMatch;
         }
       }
     }

     return null;
   };

   /**
    * @param {Element} element
    * @param {String} query dot class name or node name.
    * @return {HTMLElement/null}
    */
   util.findParent = function (element, query) {
     var match = query.substr(0, 1) === '.' ? function (node) {
       return node.classList.contains(query.substr(1));
     } : function (node) {
       return node.nodeName.toLowerCase() === query;
     };

     var parent = element.parentNode;
     for (;;) {
       if (!parent || parent === document) {
         return null;
       }
       if (match(parent)) {
         return parent;
       }
       parent = parent.parentNode;
     }
   };

   /**
    * @param {Element} element
    * @return {boolean}
    */
   util.isAttached = function (element) {
     while (document.documentElement !== element) {
       if (!element) {
         return false;
       }
       element = element.parentNode;
     }
     return true;
   };

   /**
    * @param {Element} element
    * @return {boolean}
    */
   util.hasAnyComponentAsParent = function (element) {
     while (element && document.documentElement !== element) {
       element = element.parentNode;
       if (element && element.nodeName.toLowerCase().match(/(ons-navigator|ons-tabbar|ons-sliding-menu|ons-split-view)/)) {
         return true;
       }
     }
     return false;
   };

   /**
    * @param {Element} element
    * @param {String} action to propagate
    */
   util.propagateAction = function (element, action) {
     for (var i = 0; i < element.childNodes.length; i++) {
       var child = element.childNodes[i];
       if (child[action] instanceof Function) {
         child[action]();
       } else {
         util.propagateAction(child, action);
       }
     }
   };

   /**
    * @param {String} html
    * @return {Element}
    */
   util.createElement = function (html) {
     var wrapper = document.createElement('div');
     wrapper.innerHTML = html;

     if (wrapper.children.length > 1) {
       throw new Error('"html" must be one wrapper element.');
     }

     return wrapper.children[0];
   };

   /**
    * @param {String} html
    * @return {HTMLFragment}
    */
   util.createFragment = function (html) {
     var wrapper = document.createElement('div');
     wrapper.innerHTML = html;
     var fragment = document.createDocumentFragment();

     while (wrapper.firstChild) {
       fragment.appendChild(wrapper.firstChild);
     }

     return fragment;
   };

   /*
    * @param {Object} dst Destination object.
    * @param {...Object} src Source object(s).
    * @returns {Object} Reference to `dst`.
    */
   util.extend = function (dst) {
     for (var _len = arguments.length, args = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
       args[_key - 1] = arguments[_key];
     }

     for (var i = 0; i < args.length; i++) {
       if (args[i]) {
         var keys = Object.keys(args[i]);
         for (var j = 0; j < keys.length; j++) {
           var key = keys[j];
           dst[key] = args[i][key];
         }
       }
     }

     return dst;
   };

   /**
    * @param {Object} arrayLike
    * @return {Array}
    */
   util.arrayFrom = function (arrayLike) {
     return Array.prototype.slice.apply(arrayLike);
   };

   /**
    * @param {String} jsonString
    * @param {Object} [failSafe]
    * @return {Object}
    */
   util.parseJSONObjectSafely = function (jsonString) {
     var failSafe = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

     try {
       var result = JSON.parse('' + jsonString);
       if ((typeof result === 'undefined' ? 'undefined' : babelHelpers.typeof(result)) === 'object' && result !== null) {
         return result;
       }
     } catch (e) {
       return failSafe;
     }
     return failSafe;
   };

   /**
    * @param {Element} element
    * @param {String} eventName
    * @param {Object} [detail]
    * @return {CustomEvent}
    */
   util.triggerElementEvent = function (target, eventName) {
     var detail = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

     var event = new CustomEvent(eventName, {
       bubbles: true,
       cancelable: true,
       detail: detail
     });

     Object.keys(detail).forEach(function (key) {
       event[key] = detail[key];
     });

     target.dispatchEvent(event);

     return event;
   };

   /**
    * @param {Element} target
    * @param {String} modifierName
    * @return {Boolean}
    */
   util.hasModifier = function (target, modifierName) {
     if (!target.hasAttribute('modifier')) {
       return false;
     }

     var modifiers = target.getAttribute('modifier').trim().split(/\s+/);

     for (var i = 0; i < modifiers.length; i++) {
       if (modifiers[i] === modifierName) {
         return true;
       }
     }

     return false;
   };

   /**
    * @param {Element} target
    * @param {String} modifierName
    * @return {Boolean} Whether it was added or not.
    */
   util.addModifier = function (target, modifierName) {
     if (util.hasModifier(target, modifierName)) {
       return false;
     }

     modifierName = modifierName.trim();
     var modifierAttribute = target.getAttribute('modifier') || '';
     target.setAttribute('modifier', modifierAttribute ? modifierAttribute.trim() + ' ' + modifierName : modifierName);
     return true;
   };

   /**
    * @param {Element} target
    * @param {String} modifierName
    * @return {Boolean} Whether it was found or not.
    */
   util.removeModifier = function (target, modifierName) {
     if (!target.getAttribute('modifier')) {
       return false;
     }

     var modifiers = target.getAttribute('modifier').trim().split(/\s+/);

     var newModifiers = modifiers.filter(function (item) {
       return item && item !== modifierName;
     });
     target.setAttribute('modifier', newModifiers.join(' '));

     return modifiers.length !== newModifiers.length;
   };

   /**
    * @param {String}
    * @return {Object}
    */
   util.animationOptionsParse = parse;

   var util$1 = {
     _ready: false,

     _domContentLoaded: false,

     _onDOMContentLoaded: function _onDOMContentLoaded() {
       util$1._domContentLoaded = true;

       if (ons$1.isWebView()) {
         window.document.addEventListener('deviceready', function () {
           util$1._ready = true;
         }, false);
       } else {
         util$1._ready = true;
       }
     },

     addBackButtonListener: function addBackButtonListener(fn) {
       if (!this._domContentLoaded) {
         throw new Error('This method is available after DOMContentLoaded');
       }

       if (this._ready) {
         window.document.addEventListener('backbutton', fn, false);
       } else {
         window.document.addEventListener('deviceready', function () {
           window.document.addEventListener('backbutton', fn, false);
         });
       }
     },

     removeBackButtonListener: function removeBackButtonListener(fn) {
       if (!this._domContentLoaded) {
         throw new Error('This method is available after DOMContentLoaded');
       }

       if (this._ready) {
         window.document.removeEventListener('backbutton', fn, false);
       } else {
         window.document.addEventListener('deviceready', function () {
           window.document.removeEventListener('backbutton', fn, false);
         });
       }
     }
   };
   window.addEventListener('DOMContentLoaded', function () {
     return util$1._onDOMContentLoaded();
   }, false);

   var HandlerRepository = {
     _store: {},

     _genId: (function () {
       var i = 0;
       return function () {
         return i++;
       };
     })(),

     set: function set(element, handler) {
       if (element.dataset.deviceBackButtonHandlerId) {
         this.remove(element);
       }
       var id = element.dataset.deviceBackButtonHandlerId = HandlerRepository._genId();
       this._store[id] = handler;
     },

     remove: function remove(element) {
       if (element.dataset.deviceBackButtonHandlerId) {
         delete this._store[element.dataset.deviceBackButtonHandlerId];
         delete element.dataset.deviceBackButtonHandlerId;
       }
     },

     get: function get(element) {
       if (!element.dataset.deviceBackButtonHandlerId) {
         return undefined;
       }

       var id = element.dataset.deviceBackButtonHandlerId;

       if (!this._store[id]) {
         throw new Error();
       }

       return this._store[id];
     },

     has: function has(element) {
       var id = element.dataset.deviceBackButtonHandlerId;

       return !!this._store[id];
     }
   };

   var DeviceBackButtonDispatcher = (function () {
     function DeviceBackButtonDispatcher() {
       babelHelpers.classCallCheck(this, DeviceBackButtonDispatcher);

       this._isEnabled = false;
       this._boundCallback = this._callback.bind(this);
     }

     /**
      * Enable to handle 'backbutton' events.
      */

     babelHelpers.createClass(DeviceBackButtonDispatcher, [{
       key: 'enable',
       value: function enable() {
         if (!this._isEnabled) {
           util$1.addBackButtonListener(this._boundCallback);
           this._isEnabled = true;
         }
       }

       /**
        * Disable to handle 'backbutton' events.
        */

     }, {
       key: 'disable',
       value: function disable() {
         if (this._isEnabled) {
           util$1.removeBackButtonListener(this._boundCallback);
           this._isEnabled = false;
         }
       }

       /**
        * Fire a 'backbutton' event manually.
        */

     }, {
       key: 'fireDeviceBackButtonEvent',
       value: function fireDeviceBackButtonEvent() {
         var event = document.createEvent('Event');
         event.initEvent('backbutton', true, true);
         document.dispatchEvent(event);
       }
     }, {
       key: '_callback',
       value: function _callback() {
         this._dispatchDeviceBackButtonEvent();
       }

       /**
        * @param {HTMLElement} element
        * @param {Function} callback
        */

     }, {
       key: 'createHandler',
       value: function createHandler(element, callback) {
         if (!(element instanceof HTMLElement)) {
           throw new Error('element must be an instance of HTMLElement');
         }

         if (!(callback instanceof Function)) {
           throw new Error('callback must be an instance of Function');
         }

         var handler = {
           _callback: callback,
           _element: element,

           disable: function disable() {
             HandlerRepository.remove(element);
           },

           setListener: function setListener(callback) {
             this._callback = callback;
           },

           enable: function enable() {
             HandlerRepository.set(element, this);
           },

           isEnabled: function isEnabled() {
             return HandlerRepository.get(element) === this;
           },

           destroy: function destroy() {
             HandlerRepository.remove(element);
             this._callback = this._element = null;
           }
         };

         handler.enable();

         return handler;
       }
     }, {
       key: '_dispatchDeviceBackButtonEvent',
       value: function _dispatchDeviceBackButtonEvent() {
         var tree = this._captureTree();

         var element = this._findHandlerLeafElement(tree);

         var handler = HandlerRepository.get(element);
         handler._callback(createEvent(element));

         function createEvent(element) {
           return {
             _element: element,
             callParentHandler: function callParentHandler() {
               var parent = this._element.parentNode;

               while (parent) {
                 handler = HandlerRepository.get(parent);
                 if (handler) {
                   return handler._callback(createEvent(parent));
                 }
                 parent = parent.parentNode;
               }
             }
           };
         }
       }

       /**
        * @return {Object}
        */

     }, {
       key: '_captureTree',
       value: function _captureTree() {
         return createTree(document.body);

         function createTree(element) {
           return {
             element: element,
             children: Array.prototype.concat.apply([], arrayOf(element.children).map(function (childElement) {

               if (childElement.style.display === 'none') {
                 return [];
               }

               if (childElement.children.length === 0 && !HandlerRepository.has(childElement)) {
                 return [];
               }

               var result = createTree(childElement);

               if (result.children.length === 0 && !HandlerRepository.has(result.element)) {
                 return [];
               }

               return [result];
             }))
           };
         }

         function arrayOf(target) {
           var result = [];
           for (var i = 0; i < target.length; i++) {
             result.push(target[i]);
           }
           return result;
         }
       }

       /**
        * @param {Object} tree
        * @return {HTMLElement}
        */

     }, {
       key: '_findHandlerLeafElement',
       value: function _findHandlerLeafElement(tree) {
         return find(tree);

         function find(node) {
           if (node.children.length === 0) {
             return node.element;
           }

           if (node.children.length === 1) {
             return find(node.children[0]);
           }

           return node.children.map(function (childNode) {
             return childNode.element;
           }).reduce(function (left, right) {
             if (!left) {
               return right;
             }

             var leftZ = parseInt(window.getComputedStyle(left, '').zIndex, 10);
             var rightZ = parseInt(window.getComputedStyle(right, '').zIndex, 10);

             if (!isNaN(leftZ) && !isNaN(rightZ)) {
               return leftZ > rightZ ? left : right;
             }

             throw new Error('Capturing backbutton-handler is failure.');
           }, null);
         }
       }
     }]);
     return DeviceBackButtonDispatcher;
   })();

   var deviceBackButtonDispatcher = new DeviceBackButtonDispatcher();

   var AnimatorFactory = (function () {

     /**
      * @param {Object} opts
      * @param {Object} opts.animators The dictionary for animator classes
      * @param {Function} opts.baseClass The base class of animators
      * @param {String} [opts.baseClassName] The name of the base class of animators
      * @param {String} [opts.defaultAnimation] The default animation name
      * @param {Object} [opts.defaultAnimationOptions] The default animation options
      */

     function AnimatorFactory(opts) {
       babelHelpers.classCallCheck(this, AnimatorFactory);

       this._animators = opts.animators;
       this._baseClass = opts.baseClass;
       this._baseClassName = opts.baseClassName || opts.baseClass.name;
       this._animation = opts.defaultAnimation || 'default';
       this._animationOptions = opts.defaultAnimationOptions || {};

       if (!this._animators[this._animation]) {
         throw new Error('No such animation: ' + this._animation);
       }
     }

     /**
      * @param {String} jsonString
      * @return {Object/null}
      */

     babelHelpers.createClass(AnimatorFactory, [{
       key: 'setAnimationOptions',

       /**
        * @param {Object} options
        */
       value: function setAnimationOptions(options) {
         this._animationOptions = options;
       }

       /**
        * @param {Object} options
        * @param {String} [options.animation] The animation name
        * @param {Object} [options.animationOptions] The animation options
        * @param {Object} defaultAnimator The default animator instance
        * @return {Object} An animator instance
        */

     }, {
       key: 'newAnimator',
       value: function newAnimator() {
         var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];
         var defaultAnimator = arguments[1];

         var animator = null;

         if (options.animation instanceof this._baseClass) {
           return options.animation;
         }

         var Animator = null;

         if (typeof options.animation === 'string') {
           Animator = this._animators[options.animation];
         }

         if (!Animator && defaultAnimator) {
           animator = defaultAnimator;
         } else {
           Animator = Animator || this._animators[this._animation];

           var animationOpts = util.extend({}, this._animationOptions, options.animationOptions || {}, ons$1._config.animationsDisabled ? { duration: 0, delay: 0 } : {});

           animator = new Animator(animationOpts);

           if (typeof animator === 'function') {
             animator = new animator(animationOpts); // eslint-disable-line new-cap
           }
         }

         if (!(animator instanceof this._baseClass)) {
           throw new Error('"animator" is not an instance of ' + this._baseClassName + '.');
         }

         return animator;
       }
     }], [{
       key: 'parseAnimationOptionsString',
       value: function parseAnimationOptionsString(jsonString) {
         try {
           if (typeof jsonString === 'string') {
             var result = util.animationOptionsParse(jsonString);
             if ((typeof result === 'undefined' ? 'undefined' : babelHelpers.typeof(result)) === 'object' && result !== null) {
               return result;
             } else {
               console.error('"animation-options" attribute must be a JSON object string: ' + jsonString);
             }
           }
           return {};
         } catch (e) {
           console.error('"animation-options" attribute must be a JSON object string: ' + jsonString);
           return {};
         }
       }
     }]);
     return AnimatorFactory;
   })();

   /**
    * @object ons.platform
    * @category util
    * @description
    *   [en]Utility methods to detect current platform.[/en]
    *   [ja]現在実行されているプラットフォームを検知するためのユーティリティメソッドを収めたオブジェクトです。[/ja]
    */

   var Platform = (function () {

     /**
      * All elements will be rendered as if the app was running on this platform.
      * @type {String}
      */

     function Platform() {
       babelHelpers.classCallCheck(this, Platform);

       this._renderPlatform = null;
     }

     /**
      * @method select
      * @signature select(platform)
      * @param  {string} platform Name of the platform.
      *   [en]Possible values are: "opera", "firefox", "safari", "chrome", "ie", "android", "blackberry", "ios" or "wp".[/en]
      *   [ja]"opera", "firefox", "safari", "chrome", "ie", "android", "blackberry", "ios", "wp"のいずれかを指定します。[/ja]
      * @description
      *   [en]Sets the platform used to render the elements. Useful for testing.[/en]
      *   [ja]要素を描画するために利用するプラットフォーム名を設定します。テストに便利です。[/ja]
      */

     babelHelpers.createClass(Platform, [{
       key: 'select',
       value: function select(platform) {
         this._renderPlatform = platform.trim().toLowerCase();
       }

       /**
        * @method isWebView
        * @signature isWebView()
        * @description
        *   [en]Returns whether app is running in Cordova.[/en]
        *   [ja]Cordova内で実行されているかどうかを返します。[/ja]
        * @return {Boolean}
        */

     }, {
       key: 'isWebView',
       value: function isWebView() {
         return ons$1.isWebView();
       }

       /**
        * @method isIOS
        * @signature isIOS()
        * @description
        *   [en]Returns whether the OS is iOS.[/en]
        *   [ja]iOS上で実行されているかどうかを返します。[/ja]
        * @return {Boolean}
        */

     }, {
       key: 'isIOS',
       value: function isIOS() {
         if (this._renderPlatform) {
           return this._renderPlatform === 'ios';
         } else if ((typeof device === 'undefined' ? 'undefined' : babelHelpers.typeof(device)) === 'object') {
           return (/iOS/i.test(device.platform)
           );
         } else {
           return (/iPhone|iPad|iPod/i.test(navigator.userAgent)
           );
         }
       }

       /**
        * @method isAndroid
        * @signature isAndroid()
        * @description
        *   [en]Returns whether the OS is Android.[/en]
        *   [ja]Android上で実行されているかどうかを返します。[/ja]
        * @return {Boolean}
        */

     }, {
       key: 'isAndroid',
       value: function isAndroid() {
         if (this._renderPlatform) {
           return this._renderPlatform === 'android';
         } else if ((typeof device === 'undefined' ? 'undefined' : babelHelpers.typeof(device)) === 'object') {
           return (/Android/i.test(device.platform)
           );
         } else {
           return (/Android/i.test(navigator.userAgent)
           );
         }
       }

       /**
        * @method isAndroidPhone
        * @signature isAndroidPhone()
        * @description
        *   [en]Returns whether the device is Android phone.[/en]
        *   [ja]Android携帯上で実行されているかどうかを返します。[/ja]
        * @return {Boolean}
        */

     }, {
       key: 'isAndroidPhone',
       value: function isAndroidPhone() {
         return (/Android/i.test(navigator.userAgent) && /Mobile/i.test(navigator.userAgent)
         );
       }

       /**
        * @method isAndroidTablet
        * @signature isAndroidTablet()
        * @description
        *   [en]Returns whether the device is Android tablet.[/en]
        *   [ja]Androidタブレット上で実行されているかどうかを返します。[/ja]
        * @return {Boolean}
        */

     }, {
       key: 'isAndroidTablet',
       value: function isAndroidTablet() {
         return (/Android/i.test(navigator.userAgent) && !/Mobile/i.test(navigator.userAgent)
         );
       }

       /**
        * @return {Boolean}
        */

     }, {
       key: 'isWP',
       value: function isWP() {
         if (this._renderPlatform) {
           return this._renderPlatform === 'wp';
         } else if ((typeof device === 'undefined' ? 'undefined' : babelHelpers.typeof(device)) === 'object') {
           return (/Win32NT|WinCE/i.test(device.platform)
           );
         } else {
           return (/Windows Phone|IEMobile|WPDesktop/i.test(navigator.userAgent)
           );
         }
       }

       /**
        * @methos isIPhone
        * @signature isIPhone()
        * @description
        *   [en]Returns whether the device is iPhone.[/en]
        *   [ja]iPhone上で実行されているかどうかを返します。[/ja]
        * @return {Boolean}
        */

     }, {
       key: 'isIPhone',
       value: function isIPhone() {
         return (/iPhone/i.test(navigator.userAgent)
         );
       }

       /**
        * @method isIPad
        * @signature isIPad()
        * @description
        *   [en]Returns whether the device is iPad.[/en]
        *   [ja]iPad上で実行されているかどうかを返します。[/ja]
        * @return {Boolean}
        */

     }, {
       key: 'isIPad',
       value: function isIPad() {
         return (/iPad/i.test(navigator.userAgent)
         );
       }

       /**
        * @return {Boolean}
        */

     }, {
       key: 'isIPod',
       value: function isIPod() {
         return (/iPod/i.test(navigator.userAgent)
         );
       }

       /**
        * @method isBlackBerry
        * @signature isBlackBerry()
        * @description
        *   [en]Returns whether the device is BlackBerry.[/en]
        *   [ja]BlackBerry上で実行されているかどうかを返します。[/ja]
        * @return {Boolean}
        */

     }, {
       key: 'isBlackBerry',
       value: function isBlackBerry() {
         if (this._renderPlatform) {
           return this._renderPlatform === 'blackberry';
         } else if ((typeof device === 'undefined' ? 'undefined' : babelHelpers.typeof(device)) === 'object') {
           return (/BlackBerry/i.test(device.platform)
           );
         } else {
           return (/BlackBerry|RIM Tablet OS|BB10/i.test(navigator.userAgent)
           );
         }
       }

       /**
        * @method isOpera
        * @signature isOpera()
        * @description
        *   [en]Returns whether the browser is Opera.[/en]
        *   [ja]Opera上で実行されているかどうかを返します。[/ja]
        * @return {Boolean}
        */

     }, {
       key: 'isOpera',
       value: function isOpera() {
         if (this._renderPlatform) {
           return this._renderPlatform === 'opera';
         } else {
           return !!window.opera || navigator.userAgent.indexOf(' OPR/') >= 0;
         }
       }

       /**
        * @method isFirefox
        * @signature isFirefox()
        * @description
        *   [en]Returns whether the browser is Firefox.[/en]
        *   [ja]Firefox上で実行されているかどうかを返します。[/ja]
        * @return {Boolean}
        */

     }, {
       key: 'isFirefox',
       value: function isFirefox() {
         if (this._renderPlatform) {
           return this._renderPlatform === 'firefox';
         } else {
           return typeof InstallTrigger !== 'undefined';
         }
       }

       /**
        * @method isSafari
        * @signature isSafari()
        * @description
        *   [en]Returns whether the browser is Safari.[/en]
        *   [ja]Safari上で実行されているかどうかを返します。[/ja]
        * @return {Boolean}
        */

     }, {
       key: 'isSafari',
       value: function isSafari() {
         if (this._renderPlatform) {
           return this._renderPlatform === 'safari';
         } else {
           return Object.prototype.toString.call(window.HTMLElement).indexOf('Constructor') > 0;
         }
       }

       /**
        * @method isChrome
        * @signature isChrome()
        * @description
        *   [en]Returns whether the browser is Chrome.[/en]
        *   [ja]Chrome上で実行されているかどうかを返します。[/ja]
        * @return {Boolean}
        */

     }, {
       key: 'isChrome',
       value: function isChrome() {
         if (this._renderPlatform) {
           return this._renderPlatform === 'chrome';
         } else {
           return !!window.chrome && !(!!window.opera || navigator.userAgent.indexOf(' OPR/') >= 0) && !(navigator.userAgent.indexOf(' Edge/') >= 0);
         }
       }

       /**
        * @method isIE
        * @signature isIE()
        * @description
        *   [en]Returns whether the browser is Internet Explorer.[/en]
        *   [ja]Internet Explorer上で実行されているかどうかを返します。[/ja]
        * @return {Boolean}
        */

     }, {
       key: 'isIE',
       value: function isIE() {
         if (this._renderPlatform) {
           return this._renderPlatform === 'ie';
         } else {
           return false || !!document.documentMode;
         }
       }

       /**
        * @method isEdge
        * @signature isEdge()
        * @description
        *   [en]Returns whether the browser is Edge.[/en]
        *   [ja]Edge上で実行されているかどうかを返します。[/ja]
        * @return {Boolean}
        */

     }, {
       key: 'isEdge',
       value: function isEdge() {
         if (this._renderPlatform) {
           return this._renderPlatform === 'edge';
         } else {
           return navigator.userAgent.indexOf(' Edge/') >= 0;
         }
       }

       /**
        * @method isIOS7above
        * @signature isIOS7above()
        * @description
        *   [en]Returns whether the iOS version is 7 or above.[/en]
        *   [ja]iOS7以上で実行されているかどうかを返します。[/ja]
        * @return {Boolean}
        */

     }, {
       key: 'isIOS7above',
       value: function isIOS7above() {
         if ((typeof device === 'undefined' ? 'undefined' : babelHelpers.typeof(device)) === 'object') {
           return (/iOS/i.test(device.platform) && parseInt(device.version.split('.')[0]) >= 7
           );
         } else if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
           var ver = (navigator.userAgent.match(/\b[0-9]+_[0-9]+(?:_[0-9]+)?\b/) || [''])[0].replace(/_/g, '.');
           return parseInt(ver.split('.')[0]) >= 7;
         }
         return false;
       }

       /**
        * @return {String}
        */

     }, {
       key: 'getMobileOS',
       value: function getMobileOS() {
         if (this.isAndroid()) {
           return 'android';
         } else if (this.isIOS()) {
           return 'ios';
         } else if (this.isWP()) {
           return 'wp';
         } else {
           return 'other';
         }
       }

       /**
        * @return {String}
        */

     }, {
       key: 'getIOSDevice',
       value: function getIOSDevice() {
         if (this.isIPhone()) {
           return 'iphone';
         } else if (this.isIPad()) {
           return 'ipad';
         } else if (this.isIPod()) {
           return 'ipod';
         } else {
           return 'na';
         }
       }
     }]);
     return Platform;
   })();

   var platform = new Platform();

   var pageAttributeExpression = {
     _variables: {},

     /**
      * Define a variable.
      *
      * @param {String} name Name of the variable
      * @param {String|Function} value Value of the variable. Can be a string or a function. The function must return a string.
      * @param {Boolean} overwrite If this value is false, an error will be thrown when trying to define a variable that has already been defined.
      */
     defineVariable: function defineVariable(name, value) {
       var overwrite = arguments.length <= 2 || arguments[2] === undefined ? false : arguments[2];

       if (typeof name !== 'string') {
         throw new Error('Variable name must be a string.');
       } else if (typeof value !== 'string' && typeof value !== 'function') {
         throw new Error('Variable value must be a string or a function.');
       } else if (this._variables.hasOwnProperty(name) && !overwrite) {
         throw new Error('"' + name + '" is already defined.');
       }
       this._variables[name] = value;
     },

     /**
      * Get a variable.
      *
      * @param {String} name Name of the variable.
      * @return {String|Function|null}
      */
     getVariable: function getVariable(name) {
       if (!this._variables.hasOwnProperty(name)) {
         return null;
       }

       return this._variables[name];
     },

     /**
      * Remove a variable.
      *
      * @param {String} name Name of the varaible.
      */
     removeVariable: function removeVariable(name) {
       delete this._variables[name];
     },

     /**
      * Get all variables.
      *
      * @return {Object}
      */
     getAllVariables: function getAllVariables() {
       return this._variables;
     },
     _parsePart: function _parsePart(part) {
       var c = undefined,
           inInterpolation = false,
           currentIndex = 0,
           tokens = [];

       if (part.length === 0) {
         throw new Error('Unable to parse empty string.');
       }

       for (var i = 0; i < part.length; i++) {
         c = part.charAt(i);

         if (c === '$' && part.charAt(i + 1) === '{') {
           if (inInterpolation) {
             throw new Error('Nested interpolation not supported.');
           }

           var token = part.substring(currentIndex, i);
           if (token.length > 0) {
             tokens.push(part.substring(currentIndex, i));
           }

           currentIndex = i;
           inInterpolation = true;
         } else if (c === '}') {
           if (!inInterpolation) {
             throw new Error('} must be preceeded by ${');
           }

           var token = part.substring(currentIndex, i + 1);
           if (token.length > 0) {
             tokens.push(part.substring(currentIndex, i + 1));
           }

           currentIndex = i + 1;
           inInterpolation = false;
         }
       }

       if (inInterpolation) {
         throw new Error('Unterminated interpolation.');
       }

       tokens.push(part.substring(currentIndex, part.length));

       return tokens;
     },
     _replaceToken: function _replaceToken(token) {
       var re = /^\${(.*?)}$/,
           match = token.match(re);

       if (match) {
         var name = match[1].trim(),
             variable = this.getVariable(name);

         if (variable === null) {
           throw new Error('Variable "' + name + '" does not exist.');
         } else if (typeof variable === 'string') {
           return variable;
         } else {
           var rv = variable();

           if (typeof rv !== 'string') {
             throw new Error('Must return a string.');
           }

           return rv;
         }
       } else {
         return token;
       }
     },
     _replaceTokens: function _replaceTokens(tokens) {
       return tokens.map(this._replaceToken.bind(this));
     },
     _parseExpression: function _parseExpression(expression) {
       return expression.split(',').map(function (part) {
         return part.trim();
       }).map(this._parsePart.bind(this)).map(this._replaceTokens.bind(this)).map(function (part) {
         return part.join('');
       });
     },

     /**
      * Evaluate an expression.
      *
      * @param {String} expression An page attribute expression.
      * @return {Array}
      */
     evaluate: function evaluate(expression) {
       if (!expression) {
         return [];
       }

       return this._parseExpression(expression);
     }
   };

   // Define default variables.
   pageAttributeExpression.defineVariable('mobileOS', platform.getMobileOS());
   pageAttributeExpression.defineVariable('iOSDevice', platform.getIOSDevice());
   pageAttributeExpression.defineVariable('runtime', function () {
     return platform.isWebView() ? 'cordova' : 'browser';
   });

   var internal = {};

   internal.nullElement = window.document.createElement('div');

   /**
    * @return {Boolean}
    */
   internal.isEnabledAutoStatusBarFill = function () {
     return !!ons._config.autoStatusBarFill;
   };

   /**
    * @param {String} html
    * @return {String}
    */
   internal.normalizePageHTML = function (html) {
     html = ('' + html).trim();

     if (!html.match(/^<ons-page/)) {
       html = '<ons-page _muted>' + html + '</ons-page>';
     }

     return html;
   };

   internal.waitDOMContentLoaded = function (callback) {
     if (window.document.readyState === 'loading' || window.document.readyState == 'uninitialized') {
       window.document.addEventListener('DOMContentLoaded', callback);
     } else {
       setImmediate(callback);
     }
   };

   /**
    * @param {HTMLElement} element
    * @return {Boolean}
    */
   internal.shouldFillStatusBar = function (element) {
     var checkStatusBar = function checkStatusBar() {
       if (internal.isEnabledAutoStatusBarFill() && platform.isWebView() && platform.isIOS7above()) {
         if (!(element instanceof HTMLElement)) {
           throw new Error('element must be an instance of HTMLElement');
         }

         for (;;) {
           if (element.hasAttribute('no-status-bar-fill')) {
             return false;
           }

           element = element.parentNode;
           if (!element || !element.hasAttribute) {
             return true;
           }
         }
       }
       return false;
     };

     return new Promise(function (resolve, reject) {
       if ((typeof device === 'undefined' ? 'undefined' : babelHelpers.typeof(device)) === 'object') {
         document.addEventListener('deviceready', function () {
           if (checkStatusBar()) {
             resolve();
           }
         });
       } else if (checkStatusBar()) {
         resolve();
       }
       reject();
     });
   };

   internal.templateStore = {
     _storage: {},

     /**
      * @param {String} key
      * @return {String/null} template
      */
     get: function get(key) {
       return internal.templateStore._storage[key] || null;
     },

     /**
      * @param {String} key
      * @param {String} template
      */
     set: function set(key, template) {
       internal.templateStore._storage[key] = template;
     }
   };

   window.document.addEventListener('_templateloaded', function (e) {
     if (e.target.nodeName.toLowerCase() === 'ons-template') {
       internal.templateStore.set(e.templateId, e.template);
     }
   }, false);

   window.document.addEventListener('DOMContentLoaded', function () {
     register('script[type="text/ons-template"]');
     register('script[type="text/template"]');
     register('script[type="text/ng-template"]');

     function register(query) {
       var templates = window.document.querySelectorAll(query);
       for (var i = 0; i < templates.length; i++) {
         internal.templateStore.set(templates[i].getAttribute('id'), templates[i].textContent);
       }
     }
   }, false);

   /**
    * @param {String} page
    * @return {Promise}
    */
   internal.getTemplateHTMLAsync = function (page) {
     return new Promise(function (resolve, reject) {
       setImmediate(function () {
         var cache = internal.templateStore.get(page);

         if (cache) {
           var html = typeof cache === 'string' ? cache : cache[1];
           resolve(html);
         } else {
           (function () {
             var xhr = new XMLHttpRequest();
             xhr.open('GET', page, true);
             xhr.onload = function (response) {
               var html = xhr.responseText;
               if (xhr.status >= 400 && xhr.status < 600) {
                 reject(html);
               } else {
                 resolve(html);
               }
             };
             xhr.onerror = function () {
               throw new Error('The page is not found: ' + page);
             };
             xhr.send(null);
           })();
         }
       });
     });
   };

   /**
    * @param {String} page
    * @return {Promise}
    */
   internal.getPageHTMLAsync = function (page) {
     var pages = pageAttributeExpression.evaluate(page);

     var getPage = function getPage(page) {
       if (typeof page !== 'string') {
         return Promise.reject('Must specify a page.');
       }

       return internal.getTemplateHTMLAsync(page).then(function (html) {
         return internal.normalizePageHTML(html);
       }, function (error) {
         if (pages.length === 0) {
           return Promise.reject(error);
         }

         return getPage(pages.shift());
       }).then(function (html) {
         return internal.normalizePageHTML(html);
       });
     };

     return getPage(pages.shift());
   };

   /*
   Copyright 2013-2015 ASIAL CORPORATION

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.

   */

   var ModifierUtil = (function () {
     function ModifierUtil() {
       babelHelpers.classCallCheck(this, ModifierUtil);
     }

     babelHelpers.createClass(ModifierUtil, null, [{
       key: 'diff',

       /**
        * @param {String} last
        * @param {String} current
        */
       value: function diff(last, current) {
         last = makeDict(('' + last).trim());
         current = makeDict(('' + current).trim());

         var removed = Object.keys(last).reduce(function (result, token) {
           if (!current[token]) {
             result.push(token);
           }
           return result;
         }, []);

         var added = Object.keys(current).reduce(function (result, token) {
           if (!last[token]) {
             result.push(token);
           }
           return result;
         }, []);

         return { added: added, removed: removed };

         function makeDict(modifier) {
           var dict = {};
           ModifierUtil.split(modifier).forEach(function (token) {
             return dict[token] = token;
           });
           return dict;
         }
       }

       /**
        * @param {Object} diff
        * @param {Object} classList
        * @param {String} template
        */

     }, {
       key: 'applyDiffToClassList',
       value: function applyDiffToClassList(diff, classList, template) {
         diff.added.map(function (modifier) {
           return template.replace(/\*/g, modifier);
         }).forEach(function (klass) {
           return classList.add(klass);
         });

         diff.removed.map(function (modifier) {
           return template.replace(/\*/g, modifier);
         }).forEach(function (klass) {
           return classList.remove(klass);
         });
       }

       /**
        * @param {Object} diff
        * @param {HTMLElement} element
        * @param {Object} scheme
        */

     }, {
       key: 'applyDiffToElement',
       value: function applyDiffToElement(diff, element, scheme) {
         var matches = function matches(e, s) {
           return (e.matches || e.webkitMatchesSelector || e.mozMatchesSelector || e.msMatchesSelector).call(e, s);
         };
         for (var selector in scheme) {
           if (scheme.hasOwnProperty(selector)) {
             var targetElements = !selector || matches(element, selector) ? [element] : element.querySelectorAll(selector);
             for (var i = 0; i < targetElements.length; i++) {
               ModifierUtil.applyDiffToClassList(diff, targetElements[i].classList, scheme[selector]);
             }
           }
         }
       }

       /**
        * @param {String} last
        * @param {String} current
        * @param {HTMLElement} element
        * @param {Object} scheme
        */

     }, {
       key: 'onModifierChanged',
       value: function onModifierChanged(last, current, element, scheme) {
         return ModifierUtil.applyDiffToElement(ModifierUtil.diff(last, current), element, scheme);
       }

       /**
        * @param {HTMLElement} element
        * @param {Object} scheme
        */

     }, {
       key: 'initModifier',
       value: function initModifier(element, scheme) {
         var modifier = element.getAttribute('modifier');
         if (typeof modifier !== 'string') {
           return;
         }

         ModifierUtil.applyDiffToElement({
           removed: [],
           added: ModifierUtil.split(modifier)
         }, element, scheme);
       }
     }, {
       key: 'split',
       value: function split(modifier) {
         if (typeof modifier !== 'string') {
           return [];
         }

         return modifier.trim().split(/ +/).filter(function (token) {
           return token !== '';
         });
       }
     }]);
     return ModifierUtil;
   })();

   var LazyRepeatDelegate = (function () {
     function LazyRepeatDelegate() {
       babelHelpers.classCallCheck(this, LazyRepeatDelegate);
     }

     babelHelpers.createClass(LazyRepeatDelegate, [{
       key: 'prepareItem',

       /**
        * @param {Number}
        * @param {Function} done A function that take item object as parameter.
        */
       value: function prepareItem(index, done) {
         throw new Error('This is an abstract method.');
       }

       /**
        * @return {Number}
        */

     }, {
       key: 'countItems',
       value: function countItems() {
         throw new Error('This is an abstract method.');
       }

       /**
        * @param {Number} index
        * @param {Object} item
        * @param {Element} item.element
        */

     }, {
       key: 'updateItem',
       value: function updateItem(index, item) {
         throw new Error('This is an abstract method.');
       }

       /**
        * @return {Number}
        */

     }, {
       key: 'calculateItemHeight',
       value: function calculateItemHeight(index) {
         throw new Error('This is an abstract method.');
       }

       /**
        * @param {Number} index
        * @param {Object} item
        */

     }, {
       key: 'destroyItem',
       value: function destroyItem(index, item) {
         throw new Error('This is an abstract method.');
       }

       /**
        * @return {void}
        */

     }, {
       key: 'destroy',
       value: function destroy() {
         throw new Error('This is an abstract method.');
       }
     }]);
     return LazyRepeatDelegate;
   })();

   /**
    * This class provide core functions for ons-lazy-repeat.
    */
   var LazyRepeatProvider = (function () {

     /**
      * @param {Element} wrapperElement
      * @param {LazyRepeatDelegate} delegate
      */

     function LazyRepeatProvider(wrapperElement, delegate) {
       babelHelpers.classCallCheck(this, LazyRepeatProvider);

       if (!(delegate instanceof LazyRepeatDelegate)) {
         throw new Error('"delegate" parameter must be an instance of ons._internal.LazyRepeatDelegate.');
       }

       if (!(wrapperElement instanceof Element)) {
         throw new Error('"wrapperElement" parameter must be an instance of Element.');
       }

       this._wrapperElement = wrapperElement;
       this._delegate = delegate;

       // to be removed soon
       this._pageContent = util.findParent(wrapperElement, '.ons-scroller__content');

       if (!this._pageContent) {
         this._pageContent = util.findParent(wrapperElement, '.page__content');
       }

       if (!this._pageContent) {
         throw new Error('ons-lazy-repeat must be a descendant of an <ons-page> or an <ons-scroller> element.');
       }

       this._itemHeightSum = [];
       this._maxIndex = 0;
       this._renderedItems = {};

       this._addEventListeners();

       this._onChange();
     }

     babelHelpers.createClass(LazyRepeatProvider, [{
       key: '_countItems',
       value: function _countItems() {
         return this._delegate.countItems();
       }
     }, {
       key: '_getItemHeight',
       value: function _getItemHeight(i) {
         return this._delegate.calculateItemHeight(i);
       }
     }, {
       key: '_getTopOffset',
       value: function _getTopOffset() {

         var toolbar = document.getElementsByTagName('ons-toolbar');
         var toolbarHeight = toolbar.length > 0 ? toolbar[0].clientHeight : 0;
         return this._wrapperElement.getBoundingClientRect().top + toolbarHeight;

         // if (typeof this._wrapperElement !== 'undefined' && this._wrapperElement !== null) {
         //   return this._wrapperElement.getBoundingClientRect().top;
         // } else {
         //   return 0;
         // }
       }
     }, {
       key: '_onChange',
       value: function _onChange() {
         this._render();
       }
     }, {
       key: 'refresh',
       value: function refresh() {
         this._removeAllElements();
         this._onChange();
       }
     }, {
       key: '_render',
       value: function _render() {
         var items = this._getItemsInView();
         var keep = {};

         for (var i = 0, l = items.length; i < l; i++) {
           var _item = items[i];
           this._renderElement(_item);
           keep[_item.index] = true;
         }

         for (var key in this._renderedItems) {
           if (this._renderedItems.hasOwnProperty(key) && !keep.hasOwnProperty(key)) {
             this._removeElement(key);
           }
         }

         this._wrapperElement.style.height = this._calculateListHeight() + 'px';
       }
     }, {
       key: '_calculateListHeight',
       value: function _calculateListHeight() {
         var indices = Object.keys(this._renderedItems).map(function (n) {
           return parseInt(n);
         });
         return this._itemHeightSum[indices.pop()] || 0;
       }

       /**
        * @param {Number} index
        * @return {Boolean}
        */

     }, {
       key: '_isRendered',
       value: function _isRendered(index) {
         return this._renderedItems.hasOwnProperty(index);
       }

       /**
        * @param {Object} item
        * @param {Number} item.index
        * @param {Number} item.top
        */

     }, {
       key: '_renderElement',
       value: function _renderElement(_ref) {
         var _this = this;

         var index = _ref.index;
         var top = _ref.top;

         if (this._isRendered(index)) {
           // Update content even if it's already added to DOM
           // to account for changes within the list.
           var currentItem = this._renderedItems[index];
           this._delegate.updateItem(index, currentItem);

           // Fix position.
           var element = this._renderedItems[index].element;
           element.style.top = top + 'px';
           // element.style.top = (this._wrapperElement.offsetTop + top) + 'px';
           // currentItem.element.style.top = top + 'px';

           return;
         }

         this._delegate.prepareItem(index, function (item) {
           var element = item.element;

           element.style.position = 'absolute';
           element.style.top = top + 'px';
           element.style.left = '0px';
           element.style.right = '0px';

           _this._wrapperElement.appendChild(element);

           _this._renderedItems[index] = item;
         });
       }

       /**
        * @param {Number} index
        */

     }, {
       key: '_removeElement',
       value: function _removeElement(index) {
         if (!this._isRendered(index)) {
           return;
         }

         var item = this._renderedItems[index];

         this._delegate.destroyItem(index, item);

         if (item.element.parentElement) {
           item.element.parentElement.removeChild(item.element);
         }
         item = null;

         delete this._renderedItems[index];
       }
     }, {
       key: '_removeAllElements',
       value: function _removeAllElements() {
         for (var key in this._renderedItems) {
           if (this._renderedItems.hasOwnProperty(key)) {
             this._removeElement(key);
           }
         }
       }
     }, {
       key: '_calculateStartIndex',
       value: function _calculateStartIndex(current) {
         var start = 0;
         var end = this._maxIndex;

         // Binary search for index at top of screen so
         // we can speed up rendering.
         for (;;) {
           var middle = Math.floor((start + end) / 2);
           var value = current + this._itemHeightSum[middle];

           if (end < start) {
             return 0;
           } else if (value >= 0 && value - this._getItemHeight(middle) < 0) {
             return middle;
           } else if (isNaN(value) || value >= 0) {
             end = middle - 1;
           } else {
             start = middle + 1;
           }
         }
       }
     }, {
       key: '_recalculateItemHeightSum',
       value: function _recalculateItemHeightSum() {
         var sums = this._itemHeightSum;
         for (var i = 0, sum = 0; i < Math.min(sums.length, this._countItems()); i++) {
           sum += this._getItemHeight(i);
           sums[i] = sum;
         }
       }
     }, {
       key: '_getItemsInView',
       value: function _getItemsInView() {
         var topOffset = this._getTopOffset();
         var topPosition = topOffset;
         var cnt = this._countItems();

         if (cnt !== this._itemCount) {
           this._recalculateItemHeightSum();
           this._maxIndex = cnt - 1;
         }
         this._itemCount = cnt;

         var startIndex = this._calculateStartIndex(topPosition);
         startIndex = Math.max(startIndex - 30, 0);

         if (startIndex > 0) {
           topPosition += this._itemHeightSum[startIndex - 1];
         }

         var items = [];
         for (var i = startIndex; i < cnt && topPosition < 4 * window.innerHeight; i++) {
           var h = this._getItemHeight(i);

           if (i >= this._itemHeightSum.length) {
             this._itemHeightSum = this._itemHeightSum.concat(new Array(100));
           }

           if (i > 0) {
             this._itemHeightSum[i] = this._itemHeightSum[i - 1] + h;
           } else {
             this._itemHeightSum[i] = h;
           }

           this._maxIndex = Math.max(i, this._maxIndex);

           items.push({
             index: i,
             top: topPosition - topOffset
           });

           topPosition += h;
         }

         return items;
       }
     }, {
       key: '_debounce',
       value: function _debounce(func, wait, immediate) {
         var timeout;
         return function () {
           var context = this,
               args = arguments;
           var later = function later() {
             timeout = null;
             if (!immediate) {
               func.apply(context, args);
             }
           };
           var callNow = immediate && !timeout;
           clearTimeout(timeout);
           timeout = setTimeout(later, wait);
           if (callNow) {
             func.apply(context, args);
           }
         };
       }
     }, {
       key: '_doubleFireOnTouchend',
       value: function _doubleFireOnTouchend() {
         this._render();
         this._debounce(this._render.bind(this), 100);
       }
     }, {
       key: '_addEventListeners',
       value: function _addEventListeners() {
         if (platform.isIOS()) {
           this._boundOnChange = this._debounce(this._onChange.bind(this), 30);
         } else {
           this._boundOnChange = this._onChange.bind(this);
         }

         this._boundDoubleFireOnTouchend = this._doubleFireOnTouchend.bind(this);

         this._pageContent.addEventListener('scroll', this._boundOnChange, true);

         if (platform.isIOS()) {
           this._pageContent.addEventListener('touchmove', this._boundOnChange, true);
           this._pageContent.addEventListener('touchend', this._boundDoubleFireOnTouchend, true);
         }

         window.document.addEventListener('resize', this._boundOnChange, true);
       }
     }, {
       key: '_removeEventListeners',
       value: function _removeEventListeners() {
         this._pageContent.removeEventListener('scroll', this._boundOnChange, true);

         if (platform.isIOS()) {
           this._pageContent.removeEventListener('touchmove', this._boundOnChange, true);
           this._pageContent.removeEventListener('touchend', this._boundDoubleFireOnTouchend, true);
         }

         window.document.removeEventListener('resize', this._boundOnChange, true);
       }
     }, {
       key: 'destroy',
       value: function destroy() {
         this._removeAllElements();
         this._delegate.destroy();
         this._parentElement = this._delegate = this._renderedItems = null;
         this._removeEventListeners();
       }
     }]);
     return LazyRepeatProvider;
   })();

   internal.AnimatorFactory = AnimatorFactory;
   internal.ModifierUtil = ModifierUtil;
   internal.LazyRepeatProvider = LazyRepeatProvider;
   internal.LazyRepeatDelegate = LazyRepeatDelegate;

   var Event$1;
   var Utils;
   var Detection;
   var PointerEvent;
   /**
    * @object ons.GestureDetector
    * @category util
    * @description
    *   [en]Utility class for gesture detection.[/en]
    *   [ja]ジェスチャを検知するためのユーティリティクラスです。[/ja]
    */

   /**
    * @method constructor
    * @signature constructor(element[, options])
    * @description
    *  [en]Create a new GestureDetector instance.[/en]
    *  [ja]GestureDetectorのインスタンスを生成します。[/ja]
    * @param {Element} element
    *   [en]Name of the event.[/en]
    *   [ja]ジェスチャを検知するDOM要素を指定します。[/ja]
    * @param {Object} [options]
    *   [en]Options object.[/en]
    *   [ja]オプションを指定します。[/ja]
    * @return {ons.GestureDetector.Instance}
    */
   var GestureDetector = function GestureDetector(element, options) {
     return new GestureDetector.Instance(element, options || {});
   };

   /**
    * default settings.
    * more settings are defined per gesture at `/gestures`. Each gesture can be disabled/enabled
    * by setting it's name (like `swipe`) to false.
    * You can set the defaults for all instances by changing this object before creating an instance.
    * @example
    * ````
    *  GestureDetector.defaults.drag = false;
    *  GestureDetector.defaults.behavior.touchAction = 'pan-y';
    *  delete GestureDetector.defaults.behavior.userSelect;
    * ````
    * @property defaults
    * @type {Object}
    */
   GestureDetector.defaults = {
     behavior: {
       userSelect: 'none',
       touchAction: 'pan-y',
       touchCallout: 'none',
       contentZooming: 'none',
       userDrag: 'none',
       tapHighlightColor: 'rgba(0,0,0,0)'
     }
   };

   /**
    * GestureDetector document where the base events are added at
    * @property DOCUMENT
    * @type {HTMLElement}
    * @default window.document
    */
   GestureDetector.DOCUMENT = document;

   /**
    * detect support for pointer events
    * @property HAS_POINTEREVENTS
    * @type {Boolean}
    */
   GestureDetector.HAS_POINTEREVENTS = navigator.pointerEnabled || navigator.msPointerEnabled;

   /**
    * detect support for touch events
    * @property HAS_TOUCHEVENTS
    * @type {Boolean}
    */
   GestureDetector.HAS_TOUCHEVENTS = 'ontouchstart' in window;

   /**
    * detect mobile browsers
    * @property IS_MOBILE
    * @type {Boolean}
    */
   GestureDetector.IS_MOBILE = /mobile|tablet|ip(ad|hone|od)|android|silk/i.test(navigator.userAgent);

   /**
    * detect if we want to support mouseevents at all
    * @property NO_MOUSEEVENTS
    * @type {Boolean}
    */
   GestureDetector.NO_MOUSEEVENTS = GestureDetector.HAS_TOUCHEVENTS && GestureDetector.IS_MOBILE || GestureDetector.HAS_POINTEREVENTS;

   /**
    * interval in which GestureDetector recalculates current velocity/direction/angle in ms
    * @property CALCULATE_INTERVAL
    * @type {Number}
    * @default 25
    */
   GestureDetector.CALCULATE_INTERVAL = 25;

   /**
    * eventtypes per touchevent (start, move, end) are filled by `Event.determineEventTypes` on `setup`
    * the object contains the DOM event names per type (`EVENT_START`, `EVENT_MOVE`, `EVENT_END`)
    * @property EVENT_TYPES
    * @private
    * @writeOnce
    * @type {Object}
    */
   var EVENT_TYPES = {};

   /**
    * direction strings, for safe comparisons
    * @property DIRECTION_DOWN|LEFT|UP|RIGHT
    * @final
    * @type {String}
    * @default 'down' 'left' 'up' 'right'
    */
   var DIRECTION_DOWN = GestureDetector.DIRECTION_DOWN = 'down';
   var DIRECTION_LEFT = GestureDetector.DIRECTION_LEFT = 'left';
   var DIRECTION_UP = GestureDetector.DIRECTION_UP = 'up';
   var DIRECTION_RIGHT = GestureDetector.DIRECTION_RIGHT = 'right';

   /**
    * pointertype strings, for safe comparisons
    * @property POINTER_MOUSE|TOUCH|PEN
    * @final
    * @type {String}
    * @default 'mouse' 'touch' 'pen'
    */
   var POINTER_MOUSE = GestureDetector.POINTER_MOUSE = 'mouse';
   var POINTER_TOUCH = GestureDetector.POINTER_TOUCH = 'touch';
   var POINTER_PEN = GestureDetector.POINTER_PEN = 'pen';

   /**
    * eventtypes
    * @property EVENT_START|MOVE|END|RELEASE|TOUCH
    * @final
    * @type {String}
    * @default 'start' 'change' 'move' 'end' 'release' 'touch'
    */
   var EVENT_START = GestureDetector.EVENT_START = 'start';
   var EVENT_MOVE = GestureDetector.EVENT_MOVE = 'move';
   var EVENT_END = GestureDetector.EVENT_END = 'end';
   var EVENT_RELEASE = GestureDetector.EVENT_RELEASE = 'release';
   var EVENT_TOUCH = GestureDetector.EVENT_TOUCH = 'touch';

   /**
    * if the window events are set...
    * @property READY
    * @writeOnce
    * @type {Boolean}
    * @default false
    */
   GestureDetector.READY = false;

   /**
    * plugins namespace
    * @property plugins
    * @type {Object}
    */
   GestureDetector.plugins = GestureDetector.plugins || {};

   /**
    * gestures namespace
    * see `/gestures` for the definitions
    * @property gestures
    * @type {Object}
    */
   GestureDetector.gestures = GestureDetector.gestures || {};

   /**
    * setup events to detect gestures on the document
    * this function is called when creating an new instance
    * @private
    */
   function setup() {
     if (GestureDetector.READY) {
       return;
     }

     // find what eventtypes we add listeners to
     Event$1.determineEventTypes();

     // Register all gestures inside GestureDetector.gestures
     Utils.each(GestureDetector.gestures, function (gesture) {
       Detection.register(gesture);
     });

     // Add touch events on the document
     Event$1.onTouch(GestureDetector.DOCUMENT, EVENT_MOVE, Detection.detect);
     Event$1.onTouch(GestureDetector.DOCUMENT, EVENT_END, Detection.detect);

     // GestureDetector is ready...!
     GestureDetector.READY = true;
   }

   /**
    * @module GestureDetector
    *
    * @class Utils
    * @static
    */
   Utils = GestureDetector.utils = {
     /**
      * extend method, could also be used for cloning when `dest` is an empty object.
      * changes the dest object
      * @param {Object} dest
      * @param {Object} src
      * @param {Boolean} [merge=false]  do a merge
      * @return {Object} dest
      */
     extend: function extend(dest, src, merge) {
       for (var key in src) {
         if (src.hasOwnProperty(key) && (dest[key] === undefined || !merge)) {
           dest[key] = src[key];
         }
       }
       return dest;
     },

     /**
      * simple addEventListener wrapper
      * @param {HTMLElement} element
      * @param {String} type
      * @param {Function} handler
      */
     on: function on(element, type, handler) {
       element.addEventListener(type, handler, false);
     },

     /**
      * simple removeEventListener wrapper
      * @param {HTMLElement} element
      * @param {String} type
      * @param {Function} handler
      */
     off: function off(element, type, handler) {
       element.removeEventListener(type, handler, false);
     },

     /**
      * forEach over arrays and objects
      * @param {Object|Array} obj
      * @param {Function} iterator
      * @param {any} iterator.item
      * @param {Number} iterator.index
      * @param {Object|Array} iterator.obj the source object
      * @param {Object} context value to use as `this` in the iterator
      */
     each: function each(obj, iterator, context) {
       var i, len;

       // native forEach on arrays
       if ('forEach' in obj) {
         obj.forEach(iterator, context);
         // arrays
       } else if (obj.length !== undefined) {
           for (i = 0, len = obj.length; i < len; i++) {
             if (iterator.call(context, obj[i], i, obj) === false) {
               return;
             }
           }
           // objects
         } else {
             for (i in obj) {
               if (obj.hasOwnProperty(i) && iterator.call(context, obj[i], i, obj) === false) {
                 return;
               }
             }
           }
     },

     /**
      * find if a string contains the string using indexOf
      * @param {String} src
      * @param {String} find
      * @return {Boolean} found
      */
     inStr: function inStr(src, find) {
       return src.indexOf(find) > -1;
     },

     /**
      * find if a array contains the object using indexOf or a simple polyfill
      * @param {String} src
      * @param {String} find
      * @return {Boolean|Number} false when not found, or the index
      */
     inArray: function inArray(src, find) {
       if (src.indexOf) {
         var index = src.indexOf(find);
         return index === -1 ? false : index;
       } else {
         for (var i = 0, len = src.length; i < len; i++) {
           if (src[i] === find) {
             return i;
           }
         }
         return false;
       }
     },

     /**
      * convert an array-like object (`arguments`, `touchlist`) to an array
      * @param {Object} obj
      * @return {Array}
      */
     toArray: function toArray(obj) {
       return Array.prototype.slice.call(obj, 0);
     },

     /**
      * find if a node is in the given parent
      * @param {HTMLElement} node
      * @param {HTMLElement} parent
      * @return {Boolean} found
      */
     hasParent: function hasParent(node, parent) {
       while (node) {
         if (node == parent) {
           return true;
         }
         node = node.parentNode;
       }
       return false;
     },

     /**
      * get the center of all the touches
      * @param {Array} touches
      * @return {Object} center contains `pageX`, `pageY`, `clientX` and `clientY` properties
      */
     getCenter: function getCenter(touches) {
       var pageX = [],
           pageY = [],
           clientX = [],
           clientY = [],
           min = Math.min,
           max = Math.max;

       // no need to loop when only one touch
       if (touches.length === 1) {
         return {
           pageX: touches[0].pageX,
           pageY: touches[0].pageY,
           clientX: touches[0].clientX,
           clientY: touches[0].clientY
         };
       }

       Utils.each(touches, function (touch) {
         pageX.push(touch.pageX);
         pageY.push(touch.pageY);
         clientX.push(touch.clientX);
         clientY.push(touch.clientY);
       });

       return {
         pageX: (min.apply(Math, pageX) + max.apply(Math, pageX)) / 2,
         pageY: (min.apply(Math, pageY) + max.apply(Math, pageY)) / 2,
         clientX: (min.apply(Math, clientX) + max.apply(Math, clientX)) / 2,
         clientY: (min.apply(Math, clientY) + max.apply(Math, clientY)) / 2
       };
     },

     /**
      * calculate the velocity between two points. unit is in px per ms.
      * @param {Number} deltaTime
      * @param {Number} deltaX
      * @param {Number} deltaY
      * @return {Object} velocity `x` and `y`
      */
     getVelocity: function getVelocity(deltaTime, deltaX, deltaY) {
       return {
         x: Math.abs(deltaX / deltaTime) || 0,
         y: Math.abs(deltaY / deltaTime) || 0
       };
     },

     /**
      * calculate the angle between two coordinates
      * @param {Touch} touch1
      * @param {Touch} touch2
      * @return {Number} angle
      */
     getAngle: function getAngle(touch1, touch2) {
       var x = touch2.clientX - touch1.clientX,
           y = touch2.clientY - touch1.clientY;

       return Math.atan2(y, x) * 180 / Math.PI;
     },

     /**
      * do a small comparison to get the direction between two touches.
      * @param {Touch} touch1
      * @param {Touch} touch2
      * @return {String} direction matches `DIRECTION_LEFT|RIGHT|UP|DOWN`
      */
     getDirection: function getDirection(touch1, touch2) {
       var x = Math.abs(touch1.clientX - touch2.clientX),
           y = Math.abs(touch1.clientY - touch2.clientY);

       if (x >= y) {
         return touch1.clientX - touch2.clientX > 0 ? DIRECTION_LEFT : DIRECTION_RIGHT;
       }
       return touch1.clientY - touch2.clientY > 0 ? DIRECTION_UP : DIRECTION_DOWN;
     },

     /**
      * calculate the distance between two touches
      * @param {Touch}touch1
      * @param {Touch} touch2
      * @return {Number} distance
      */
     getDistance: function getDistance(touch1, touch2) {
       var x = touch2.clientX - touch1.clientX,
           y = touch2.clientY - touch1.clientY;

       return Math.sqrt(x * x + y * y);
     },

     /**
      * calculate the scale factor between two touchLists
      * no scale is 1, and goes down to 0 when pinched together, and bigger when pinched out
      * @param {Array} start array of touches
      * @param {Array} end array of touches
      * @return {Number} scale
      */
     getScale: function getScale(start, end) {
       // need two fingers...
       if (start.length >= 2 && end.length >= 2) {
         return this.getDistance(end[0], end[1]) / this.getDistance(start[0], start[1]);
       }
       return 1;
     },

     /**
      * calculate the rotation degrees between two touchLists
      * @param {Array} start array of touches
      * @param {Array} end array of touches
      * @return {Number} rotation
      */
     getRotation: function getRotation(start, end) {
       // need two fingers
       if (start.length >= 2 && end.length >= 2) {
         return this.getAngle(end[1], end[0]) - this.getAngle(start[1], start[0]);
       }
       return 0;
     },

     /**
      * find out if the direction is vertical   *
      * @param {String} direction matches `DIRECTION_UP|DOWN`
      * @return {Boolean} is_vertical
      */
     isVertical: function isVertical(direction) {
       return direction == DIRECTION_UP || direction == DIRECTION_DOWN;
     },

     /**
      * set css properties with their prefixes
      * @param {HTMLElement} element
      * @param {String} prop
      * @param {String} value
      * @param {Boolean} [toggle=true]
      * @return {Boolean}
      */
     setPrefixedCss: function setPrefixedCss(element, prop, value, toggle) {
       var prefixes = ['', 'Webkit', 'Moz', 'O', 'ms'];
       prop = Utils.toCamelCase(prop);

       for (var i = 0; i < prefixes.length; i++) {
         var p = prop;
         // prefixes
         if (prefixes[i]) {
           p = prefixes[i] + p.slice(0, 1).toUpperCase() + p.slice(1);
         }

         // test the style
         if (p in element.style) {
           element.style[p] = (toggle === null || toggle) && value || '';
           break;
         }
       }
     },

     /**
      * toggle browser default behavior by setting css properties.
      * `userSelect='none'` also sets `element.onselectstart` to false
      * `userDrag='none'` also sets `element.ondragstart` to false
      *
      * @param {HtmlElement} element
      * @param {Object} props
      * @param {Boolean} [toggle=true]
      */
     toggleBehavior: function toggleBehavior(element, props, toggle) {
       if (!props || !element || !element.style) {
         return;
       }

       // set the css properties
       Utils.each(props, function (value, prop) {
         Utils.setPrefixedCss(element, prop, value, toggle);
       });

       var falseFn = toggle && function () {
         return false;
       };

       // also the disable onselectstart
       if (props.userSelect == 'none') {
         element.onselectstart = falseFn;
       }
       // and disable ondragstart
       if (props.userDrag == 'none') {
         element.ondragstart = falseFn;
       }
     },

     /**
      * convert a string with underscores to camelCase
      * so prevent_default becomes preventDefault
      * @param {String} str
      * @return {String} camelCaseStr
      */
     toCamelCase: function toCamelCase(str) {
       return str.replace(/[_-]([a-z])/g, function (s) {
         return s[1].toUpperCase();
       });
     }
   };

   /**
    * @module GestureDetector
    */
   /**
    * @class Event
    * @static
    */
   Event$1 = GestureDetector.event = {
     /**
      * when touch events have been fired, this is true
      * this is used to stop mouse events
      * @property prevent_mouseevents
      * @private
      * @type {Boolean}
      */
     preventMouseEvents: false,

     /**
      * if EVENT_START has been fired
      * @property started
      * @private
      * @type {Boolean}
      */
     started: false,

     /**
      * when the mouse is hold down, this is true
      * @property should_detect
      * @private
      * @type {Boolean}
      */
     shouldDetect: false,

     /**
      * simple event binder with a hook and support for multiple types
      * @param {HTMLElement} element
      * @param {String} type
      * @param {Function} handler
      * @param {Function} [hook]
      * @param {Object} hook.type
      */
     on: function on(element, type, handler, hook) {
       var types = type.split(' ');
       Utils.each(types, function (type) {
         Utils.on(element, type, handler);
         hook && hook(type);
       });
     },

     /**
      * simple event unbinder with a hook and support for multiple types
      * @param {HTMLElement} element
      * @param {String} type
      * @param {Function} handler
      * @param {Function} [hook]
      * @param {Object} hook.type
      */
     off: function off(element, type, handler, hook) {
       var types = type.split(' ');
       Utils.each(types, function (type) {
         Utils.off(element, type, handler);
         hook && hook(type);
       });
     },

     /**
      * the core touch event handler.
      * this finds out if we should to detect gestures
      * @param {HTMLElement} element
      * @param {String} eventType matches `EVENT_START|MOVE|END`
      * @param {Function} handler
      * @return onTouchHandler {Function} the core event handler
      */
     onTouch: function onTouch(element, eventType, handler) {
       var self = this;

       var onTouchHandler = function onTouchHandler(ev) {
         var srcType = ev.type.toLowerCase(),
             isPointer = GestureDetector.HAS_POINTEREVENTS,
             isMouse = Utils.inStr(srcType, 'mouse'),
             triggerType;

         // if we are in a mouseevent, but there has been a touchevent triggered in this session
         // we want to do nothing. simply break out of the event.
         if (isMouse && self.preventMouseEvents) {
           return;

           // mousebutton must be down
         } else if (isMouse && eventType == EVENT_START && ev.button === 0) {
             self.preventMouseEvents = false;
             self.shouldDetect = true;
           } else if (isPointer && eventType == EVENT_START) {
             self.shouldDetect = ev.buttons === 1 || PointerEvent.matchType(POINTER_TOUCH, ev);
             // just a valid start event, but no mouse
           } else if (!isMouse && eventType == EVENT_START) {
               self.preventMouseEvents = true;
               self.shouldDetect = true;
             }

         // update the pointer event before entering the detection
         if (isPointer && eventType != EVENT_END) {
           PointerEvent.updatePointer(eventType, ev);
         }

         // we are in a touch/down state, so allowed detection of gestures
         if (self.shouldDetect) {
           triggerType = self.doDetect.call(self, ev, eventType, element, handler);
         }

         // ...and we are done with the detection
         // so reset everything to start each detection totally fresh
         if (triggerType == EVENT_END) {
           self.preventMouseEvents = false;
           self.shouldDetect = false;
           PointerEvent.reset();
           // update the pointerevent object after the detection
         }

         if (isPointer && eventType == EVENT_END) {
           PointerEvent.updatePointer(eventType, ev);
         }
       };

       this.on(element, EVENT_TYPES[eventType], onTouchHandler);
       return onTouchHandler;
     },

     /**
      * the core detection method
      * this finds out what GestureDetector-touch-events to trigger
      * @param {Object} ev
      * @param {String} eventType matches `EVENT_START|MOVE|END`
      * @param {HTMLElement} element
      * @param {Function} handler
      * @return {String} triggerType matches `EVENT_START|MOVE|END`
      */
     doDetect: function doDetect(ev, eventType, element, handler) {
       var touchList = this.getTouchList(ev, eventType);
       var touchListLength = touchList.length;
       var triggerType = eventType;
       var triggerChange = touchList.trigger; // used by fakeMultitouch plugin
       var changedLength = touchListLength;

       // at each touchstart-like event we want also want to trigger a TOUCH event...
       if (eventType == EVENT_START) {
         triggerChange = EVENT_TOUCH;
         // ...the same for a touchend-like event
       } else if (eventType == EVENT_END) {
           triggerChange = EVENT_RELEASE;

           // keep track of how many touches have been removed
           changedLength = touchList.length - (ev.changedTouches ? ev.changedTouches.length : 1);
         }

       // after there are still touches on the screen,
       // we just want to trigger a MOVE event. so change the START or END to a MOVE
       // but only after detection has been started, the first time we actually want a START
       if (changedLength > 0 && this.started) {
         triggerType = EVENT_MOVE;
       }

       // detection has been started, we keep track of this, see above
       this.started = true;

       // generate some event data, some basic information
       var evData = this.collectEventData(element, triggerType, touchList, ev);

       // trigger the triggerType event before the change (TOUCH, RELEASE) events
       // but the END event should be at last
       if (eventType != EVENT_END) {
         handler.call(Detection, evData);
       }

       // trigger a change (TOUCH, RELEASE) event, this means the length of the touches changed
       if (triggerChange) {
         evData.changedLength = changedLength;
         evData.eventType = triggerChange;

         handler.call(Detection, evData);

         evData.eventType = triggerType;
         delete evData.changedLength;
       }

       // trigger the END event
       if (triggerType == EVENT_END) {
         handler.call(Detection, evData);

         // ...and we are done with the detection
         // so reset everything to start each detection totally fresh
         this.started = false;
       }

       return triggerType;
     },

     /**
      * we have different events for each device/browser
      * determine what we need and set them in the EVENT_TYPES constant
      * the `onTouch` method is bind to these properties.
      * @return {Object} events
      */
     determineEventTypes: function determineEventTypes() {
       var types;
       if (GestureDetector.HAS_POINTEREVENTS) {
         if (window.PointerEvent) {
           types = ['pointerdown', 'pointermove', 'pointerup pointercancel lostpointercapture'];
         } else {
           types = ['MSPointerDown', 'MSPointerMove', 'MSPointerUp MSPointerCancel MSLostPointerCapture'];
         }
       } else if (GestureDetector.NO_MOUSEEVENTS) {
         types = ['touchstart', 'touchmove', 'touchend touchcancel'];
       } else {
         types = ['touchstart mousedown', 'touchmove mousemove', 'touchend touchcancel mouseup'];
       }

       EVENT_TYPES[EVENT_START] = types[0];
       EVENT_TYPES[EVENT_MOVE] = types[1];
       EVENT_TYPES[EVENT_END] = types[2];
       return EVENT_TYPES;
     },

     /**
      * create touchList depending on the event
      * @param {Object} ev
      * @param {String} eventType
      * @return {Array} touches
      */
     getTouchList: function getTouchList(ev, eventType) {
       // get the fake pointerEvent touchlist
       if (GestureDetector.HAS_POINTEREVENTS) {
         return PointerEvent.getTouchList();
       }

       // get the touchlist
       if (ev.touches) {
         if (eventType == EVENT_MOVE) {
           return ev.touches;
         }

         var identifiers = [];
         var concat = [].concat(Utils.toArray(ev.touches), Utils.toArray(ev.changedTouches));
         var touchList = [];

         Utils.each(concat, function (touch) {
           if (Utils.inArray(identifiers, touch.identifier) === false) {
             touchList.push(touch);
           }
           identifiers.push(touch.identifier);
         });

         return touchList;
       }

       // make fake touchList from mouse position
       ev.identifier = 1;
       return [ev];
     },

     /**
      * collect basic event data
      * @param {HTMLElement} element
      * @param {String} eventType matches `EVENT_START|MOVE|END`
      * @param {Array} touches
      * @param {Object} ev
      * @return {Object} ev
      */
     collectEventData: function collectEventData(element, eventType, touches, ev) {
       // find out pointerType
       var pointerType = POINTER_TOUCH;
       if (Utils.inStr(ev.type, 'mouse') || PointerEvent.matchType(POINTER_MOUSE, ev)) {
         pointerType = POINTER_MOUSE;
       } else if (PointerEvent.matchType(POINTER_PEN, ev)) {
         pointerType = POINTER_PEN;
       }

       return {
         center: Utils.getCenter(touches),
         timeStamp: Date.now(),
         target: ev.target,
         touches: touches,
         eventType: eventType,
         pointerType: pointerType,
         srcEvent: ev,

         /**
          * prevent the browser default actions
          * mostly used to disable scrolling of the browser
          */
         preventDefault: function preventDefault() {
           var srcEvent = this.srcEvent;
           srcEvent.preventManipulation && srcEvent.preventManipulation();
           srcEvent.preventDefault && srcEvent.preventDefault();
         },

         /**
          * stop bubbling the event up to its parents
          */
         stopPropagation: function stopPropagation() {
           this.srcEvent.stopPropagation();
         },

         /**
          * immediately stop gesture detection
          * might be useful after a swipe was detected
          * @return {*}
          */
         stopDetect: function stopDetect() {
           return Detection.stopDetect();
         }
       };
     }
   };

   /**
    * @module GestureDetector
    *
    * @class PointerEvent
    * @static
    */
   PointerEvent = GestureDetector.PointerEvent = {
     /**
      * holds all pointers, by `identifier`
      * @property pointers
      * @type {Object}
      */
     pointers: {},

     /**
      * get the pointers as an array
      * @return {Array} touchlist
      */
     getTouchList: function getTouchList() {
       var touchlist = [];
       // we can use forEach since pointerEvents only is in IE10
       Utils.each(this.pointers, function (pointer) {
         touchlist.push(pointer);
       });
       return touchlist;
     },

     /**
      * update the position of a pointer
      * @param {String} eventType matches `EVENT_START|MOVE|END`
      * @param {Object} pointerEvent
      */
     updatePointer: function updatePointer(eventType, pointerEvent) {
       if (eventType == EVENT_END || eventType != EVENT_END && pointerEvent.buttons !== 1) {
         delete this.pointers[pointerEvent.pointerId];
       } else {
         pointerEvent.identifier = pointerEvent.pointerId;
         this.pointers[pointerEvent.pointerId] = pointerEvent;
       }
     },

     /**
      * check if ev matches pointertype
      * @param {String} pointerType matches `POINTER_MOUSE|TOUCH|PEN`
      * @param {PointerEvent} ev
      */
     matchType: function matchType(pointerType, ev) {
       if (!ev.pointerType) {
         return false;
       }

       var pt = ev.pointerType,
           types = {};

       types[POINTER_MOUSE] = pt === (ev.MSPOINTER_TYPE_MOUSE || POINTER_MOUSE);
       types[POINTER_TOUCH] = pt === (ev.MSPOINTER_TYPE_TOUCH || POINTER_TOUCH);
       types[POINTER_PEN] = pt === (ev.MSPOINTER_TYPE_PEN || POINTER_PEN);
       return types[pointerType];
     },

     /**
      * reset the stored pointers
      */
     reset: function resetList() {
       this.pointers = {};
     }
   };

   /**
    * @module GestureDetector
    *
    * @class Detection
    * @static
    */
   Detection = GestureDetector.detection = {
     // contains all registered GestureDetector.gestures in the correct order
     gestures: [],

     // data of the current GestureDetector.gesture detection session
     current: null,

     // the previous GestureDetector.gesture session data
     // is a full clone of the previous gesture.current object
     previous: null,

     // when this becomes true, no gestures are fired
     stopped: false,

     /**
      * start GestureDetector.gesture detection
      * @param {GestureDetector.Instance} inst
      * @param {Object} eventData
      */
     startDetect: function startDetect(inst, eventData) {
       // already busy with a GestureDetector.gesture detection on an element
       if (this.current) {
         return;
       }

       this.stopped = false;

       // holds current session
       this.current = {
         inst: inst, // reference to GestureDetectorInstance we're working for
         startEvent: Utils.extend({}, eventData), // start eventData for distances, timing etc
         lastEvent: false, // last eventData
         lastCalcEvent: false, // last eventData for calculations.
         futureCalcEvent: false, // last eventData for calculations.
         lastCalcData: {}, // last lastCalcData
         name: '' // current gesture we're in/detected, can be 'tap', 'hold' etc
       };

       this.detect(eventData);
     },

     /**
      * GestureDetector.gesture detection
      * @param {Object} eventData
      * @return {any}
      */
     detect: function detect(eventData) {
       if (!this.current || this.stopped) {
         return;
       }

       // extend event data with calculations about scale, distance etc
       eventData = this.extendEventData(eventData);

       // GestureDetector instance and instance options
       var inst = this.current.inst,
           instOptions = inst.options;

       // call GestureDetector.gesture handlers
       Utils.each(this.gestures, function triggerGesture(gesture) {
         // only when the instance options have enabled this gesture
         if (!this.stopped && inst.enabled && instOptions[gesture.name]) {
           gesture.handler.call(gesture, eventData, inst);
         }
       }, this);

       // store as previous event event
       if (this.current) {
         this.current.lastEvent = eventData;
       }

       if (eventData.eventType == EVENT_END) {
         this.stopDetect();
       }

       return eventData; // eslint-disable-line consistent-return
     },

     /**
      * clear the GestureDetector.gesture vars
      * this is called on endDetect, but can also be used when a final GestureDetector.gesture has been detected
      * to stop other GestureDetector.gestures from being fired
      */
     stopDetect: function stopDetect() {
       // clone current data to the store as the previous gesture
       // used for the double tap gesture, since this is an other gesture detect session
       this.previous = Utils.extend({}, this.current);

       // reset the current
       this.current = null;
       this.stopped = true;
     },

     /**
      * calculate velocity, angle and direction
      * @param {Object} ev
      * @param {Object} center
      * @param {Number} deltaTime
      * @param {Number} deltaX
      * @param {Number} deltaY
      */
     getCalculatedData: function getCalculatedData(ev, center, deltaTime, deltaX, deltaY) {
       var cur = this.current,
           recalc = false,
           calcEv = cur.lastCalcEvent,
           calcData = cur.lastCalcData;

       if (calcEv && ev.timeStamp - calcEv.timeStamp > GestureDetector.CALCULATE_INTERVAL) {
         center = calcEv.center;
         deltaTime = ev.timeStamp - calcEv.timeStamp;
         deltaX = ev.center.clientX - calcEv.center.clientX;
         deltaY = ev.center.clientY - calcEv.center.clientY;
         recalc = true;
       }

       if (ev.eventType == EVENT_TOUCH || ev.eventType == EVENT_RELEASE) {
         cur.futureCalcEvent = ev;
       }

       if (!cur.lastCalcEvent || recalc) {
         calcData.velocity = Utils.getVelocity(deltaTime, deltaX, deltaY);
         calcData.angle = Utils.getAngle(center, ev.center);
         calcData.direction = Utils.getDirection(center, ev.center);

         cur.lastCalcEvent = cur.futureCalcEvent || ev;
         cur.futureCalcEvent = ev;
       }

       ev.velocityX = calcData.velocity.x;
       ev.velocityY = calcData.velocity.y;
       ev.interimAngle = calcData.angle;
       ev.interimDirection = calcData.direction;
     },

     /**
      * extend eventData for GestureDetector.gestures
      * @param {Object} ev
      * @return {Object} ev
      */
     extendEventData: function extendEventData(ev) {
       var cur = this.current,
           startEv = cur.startEvent,
           lastEv = cur.lastEvent || startEv;

       // update the start touchlist to calculate the scale/rotation
       if (ev.eventType == EVENT_TOUCH || ev.eventType == EVENT_RELEASE) {
         startEv.touches = [];
         Utils.each(ev.touches, function (touch) {
           startEv.touches.push({
             clientX: touch.clientX,
             clientY: touch.clientY
           });
         });
       }

       var deltaTime = ev.timeStamp - startEv.timeStamp,
           deltaX = ev.center.clientX - startEv.center.clientX,
           deltaY = ev.center.clientY - startEv.center.clientY;

       this.getCalculatedData(ev, lastEv.center, deltaTime, deltaX, deltaY);

       Utils.extend(ev, {
         startEvent: startEv,

         deltaTime: deltaTime,
         deltaX: deltaX,
         deltaY: deltaY,

         distance: Utils.getDistance(startEv.center, ev.center),
         angle: Utils.getAngle(startEv.center, ev.center),
         direction: Utils.getDirection(startEv.center, ev.center),
         scale: Utils.getScale(startEv.touches, ev.touches),
         rotation: Utils.getRotation(startEv.touches, ev.touches)
       });

       return ev;
     },

     /**
      * register new gesture
      * @param {Object} gesture object, see `gestures/` for documentation
      * @return {Array} gestures
      */
     register: function register(gesture) {
       // add an enable gesture options if there is no given
       var options = gesture.defaults || {};
       if (options[gesture.name] === undefined) {
         options[gesture.name] = true;
       }

       // extend GestureDetector default options with the GestureDetector.gesture options
       Utils.extend(GestureDetector.defaults, options, true);

       // set its index
       gesture.index = gesture.index || 1000;

       // add GestureDetector.gesture to the list
       this.gestures.push(gesture);

       // sort the list by index
       this.gestures.sort(function (a, b) {
         if (a.index < b.index) {
           return -1;
         }
         if (a.index > b.index) {
           return 1;
         }
         return 0;
       });

       return this.gestures;
     }
   };

   /**
    * @module GestureDetector
    */

   /**
    * create new GestureDetector instance
    * all methods should return the instance itself, so it is chainable.
    *
    * @class Instance
    * @constructor
    * @param {HTMLElement} element
    * @param {Object} [options={}] options are merged with `GestureDetector.defaults`
    * @return {GestureDetector.Instance}
    */
   GestureDetector.Instance = function (element, options) {
     var self = this;

     // setup GestureDetectorJS window events and register all gestures
     // this also sets up the default options
     setup();

     /**
      * @property element
      * @type {HTMLElement}
      */
     this.element = element;

     /**
      * @property enabled
      * @type {Boolean}
      * @protected
      */
     this.enabled = true;

     /**
      * options, merged with the defaults
      * options with an _ are converted to camelCase
      * @property options
      * @type {Object}
      */
     Utils.each(options, function (value, name) {
       delete options[name];
       options[Utils.toCamelCase(name)] = value;
     });

     this.options = Utils.extend(Utils.extend({}, GestureDetector.defaults), options || {});

     // add some css to the element to prevent the browser from doing its native behavior
     if (this.options.behavior) {
       Utils.toggleBehavior(this.element, this.options.behavior, true);
     }

     /**
      * event start handler on the element to start the detection
      * @property eventStartHandler
      * @type {Object}
      */
     this.eventStartHandler = Event$1.onTouch(element, EVENT_START, function (ev) {
       if (self.enabled && ev.eventType == EVENT_START) {
         Detection.startDetect(self, ev);
       } else if (ev.eventType == EVENT_TOUCH) {
         Detection.detect(ev);
       }
     });

     /**
      * keep a list of user event handlers which needs to be removed when calling 'dispose'
      * @property eventHandlers
      * @type {Array}
      */
     this.eventHandlers = [];
   };

   GestureDetector.Instance.prototype = {
     /**
      * @method on
      * @signature on(gestures, handler)
      * @description
      *  [en]Adds an event handler for a gesture. Available gestures are: drag, dragleft, dragright, dragup, dragdown, hold, release, swipe, swipeleft, swiperight, swipeup, swipedown, tap, doubletap, touch, transform, pinch, pinchin, pinchout and rotate. [/en]
      *  [ja]ジェスチャに対するイベントハンドラを追加します。指定できるジェスチャ名は、drag dragleft dragright dragup dragdown hold release swipe swipeleft swiperight swipeup swipedown tap doubletap touch transform pinch pinchin pinchout rotate です。[/ja]
      * @param {String} gestures
      *   [en]A space separated list of gestures.[/en]
      *   [ja]検知するジェスチャ名を指定します。スペースで複数指定することができます。[/ja]
      * @param {Function} handler
      *   [en]An event handling function.[/en]
      *   [ja]イベントハンドラとなる関数オブジェクトを指定します。[/ja]
      */
     on: function onEvent(gestures, handler) {
       var self = this;
       Event$1.on(self.element, gestures, handler, function (type) {
         self.eventHandlers.push({ gesture: type, handler: handler });
       });
       return self;
     },

     /**
      * @method off
      * @signature off(gestures, handler)
      * @description
      *  [en]Remove an event listener.[/en]
      *  [ja]イベントリスナーを削除します。[/ja]
      * @param {String} gestures
      *   [en]A space separated list of gestures.[/en]
      *   [ja]ジェスチャ名を指定します。スペースで複数指定することができます。[/ja]
      * @param {Function} handler
      *   [en]An event handling function.[/en]
      *   [ja]イベントハンドラとなる関数オブジェクトを指定します。[/ja]
      */
     off: function offEvent(gestures, handler) {
       var self = this;

       Event$1.off(self.element, gestures, handler, function (type) {
         var index = Utils.inArray({ gesture: type, handler: handler });
         if (index !== false) {
           self.eventHandlers.splice(index, 1);
         }
       });
       return self;
     },

     /**
      * trigger gesture event
      * @method trigger
      * @signature trigger(gesture, eventData)
      * @param {String} gesture
      * @param {Object} [eventData]
      */
     trigger: function triggerEvent(gesture, eventData) {
       // optional
       if (!eventData) {
         eventData = {};
       }

       // create DOM event
       var event = GestureDetector.DOCUMENT.createEvent('Event');
       event.initEvent(gesture, true, true);
       event.gesture = eventData;

       // trigger on the target if it is in the instance element,
       // this is for event delegation tricks
       var element = this.element;
       if (Utils.hasParent(eventData.target, element)) {
         element = eventData.target;
       }

       element.dispatchEvent(event);
       return this;
     },

     /**
      * @method enable
      * @signature enable(state)
      * @description
      *  [en]Enable or disable gesture detection.[/en]
      *  [ja]ジェスチャ検知を有効化/無効化します。[/ja]
      * @param {Boolean} state
      *   [en]Specify if it should be enabled or not.[/en]
      *   [ja]有効にするかどうかを指定します。[/ja]
      */
     enable: function enable(state) {
       this.enabled = state;
       return this;
     },

     /**
      * @method dispose
      * @signature dispose()
      * @description
      *  [en]Remove and destroy all event handlers for this instance.[/en]
      *  [ja]このインスタンスでのジェスチャの検知や、イベントハンドラを全て解除して廃棄します。[/ja]
      */
     dispose: function dispose() {
       var i, eh;

       // undo all changes made by stop_browser_behavior
       Utils.toggleBehavior(this.element, this.options.behavior, false);

       // unbind all custom event handlers
       for (i = -1; eh = this.eventHandlers[++i];) {
         // eslint-disable-line no-cond-assign
         Utils.off(this.element, eh.gesture, eh.handler);
       }

       this.eventHandlers = [];

       // unbind the start event listener
       Event$1.off(this.element, EVENT_TYPES[EVENT_START], this.eventStartHandler);

       return null;
     }
   };

   /**
    * @module gestures
    */
   /**
    * Move with x fingers (default 1) around on the page.
    * Preventing the default browser behavior is a good way to improve feel and working.
    * ````
    *  GestureDetectortime.on("drag", function(ev) {
    *    console.log(ev);
    *    ev.gesture.preventDefault();
    *  });
    * ````
    *
    * @class Drag
    * @static
    */
   /**
    * @event drag
    * @param {Object} ev
    */
   /**
    * @event dragstart
    * @param {Object} ev
    */
   /**
    * @event dragend
    * @param {Object} ev
    */
   /**
    * @event drapleft
    * @param {Object} ev
    */
   /**
    * @event dragright
    * @param {Object} ev
    */
   /**
    * @event dragup
    * @param {Object} ev
    */
   /**
    * @event dragdown
    * @param {Object} ev
    */

   /**
    * @param {String} name
    */
   (function (name) {
     var triggered = false;

     function dragGesture(ev, inst) {
       var cur = Detection.current;

       // max touches
       if (inst.options.dragMaxTouches > 0 && ev.touches.length > inst.options.dragMaxTouches) {
         return;
       }

       switch (ev.eventType) {
         case EVENT_START:
           triggered = false;
           break;

         case EVENT_MOVE:
           // when the distance we moved is too small we skip this gesture
           // or we can be already in dragging
           if (ev.distance < inst.options.dragMinDistance && cur.name != name) {
             return;
           }

           var startCenter = cur.startEvent.center;

           // we are dragging!
           if (cur.name != name) {
             cur.name = name;
             if (inst.options.dragDistanceCorrection && ev.distance > 0) {
               // When a drag is triggered, set the event center to dragMinDistance pixels from the original event center.
               // Without this correction, the dragged distance would jumpstart at dragMinDistance pixels instead of at 0.
               // It might be useful to save the original start point somewhere
               var factor = Math.abs(inst.options.dragMinDistance / ev.distance);
               startCenter.pageX += ev.deltaX * factor;
               startCenter.pageY += ev.deltaY * factor;
               startCenter.clientX += ev.deltaX * factor;
               startCenter.clientY += ev.deltaY * factor;

               // recalculate event data using new start point
               ev = Detection.extendEventData(ev);
             }
           }

           // lock drag to axis?
           if (cur.lastEvent.dragLockToAxis || inst.options.dragLockToAxis && inst.options.dragLockMinDistance <= ev.distance) {
             ev.dragLockToAxis = true;
           }

           // keep direction on the axis that the drag gesture started on
           var lastDirection = cur.lastEvent.direction;
           if (ev.dragLockToAxis && lastDirection !== ev.direction) {
             if (Utils.isVertical(lastDirection)) {
               ev.direction = ev.deltaY < 0 ? DIRECTION_UP : DIRECTION_DOWN;
             } else {
               ev.direction = ev.deltaX < 0 ? DIRECTION_LEFT : DIRECTION_RIGHT;
             }
           }

           // first time, trigger dragstart event
           if (!triggered) {
             inst.trigger(name + 'start', ev);
             triggered = true;
           }

           // trigger events
           inst.trigger(name, ev);
           inst.trigger(name + ev.direction, ev);

           var isVertical = Utils.isVertical(ev.direction);

           // block the browser events
           if (inst.options.dragBlockVertical && isVertical || inst.options.dragBlockHorizontal && !isVertical) {
             ev.preventDefault();
           }
           break;

         case EVENT_RELEASE:
           if (triggered && ev.changedLength <= inst.options.dragMaxTouches) {
             inst.trigger(name + 'end', ev);
             triggered = false;
           }
           break;

         case EVENT_END:
           triggered = false;
           break;
       }
     }

     GestureDetector.gestures.Drag = {
       name: name,
       index: 50,
       handler: dragGesture,
       defaults: {
         /**
          * minimal movement that have to be made before the drag event gets triggered
          * @property dragMinDistance
          * @type {Number}
          * @default 10
          */
         dragMinDistance: 10,

         /**
          * Set dragDistanceCorrection to true to make the starting point of the drag
          * be calculated from where the drag was triggered, not from where the touch started.
          * Useful to avoid a jerk-starting drag, which can make fine-adjustments
          * through dragging difficult, and be visually unappealing.
          * @property dragDistanceCorrection
          * @type {Boolean}
          * @default true
          */
         dragDistanceCorrection: true,

         /**
          * set 0 for unlimited, but this can conflict with transform
          * @property dragMaxTouches
          * @type {Number}
          * @default 1
          */
         dragMaxTouches: 1,

         /**
          * prevent default browser behavior when dragging occurs
          * be careful with it, it makes the element a blocking element
          * when you are using the drag gesture, it is a good practice to set this true
          * @property dragBlockHorizontal
          * @type {Boolean}
          * @default false
          */
         dragBlockHorizontal: false,

         /**
          * same as `dragBlockHorizontal`, but for vertical movement
          * @property dragBlockVertical
          * @type {Boolean}
          * @default false
          */
         dragBlockVertical: false,

         /**
          * dragLockToAxis keeps the drag gesture on the axis that it started on,
          * It disallows vertical directions if the initial direction was horizontal, and vice versa.
          * @property dragLockToAxis
          * @type {Boolean}
          * @default false
          */
         dragLockToAxis: false,

         /**
          * drag lock only kicks in when distance > dragLockMinDistance
          * This way, locking occurs only when the distance has become large enough to reliably determine the direction
          * @property dragLockMinDistance
          * @type {Number}
          * @default 25
          */
         dragLockMinDistance: 25
       }
     };
   })('drag');

   /**
    * @module gestures
    */
   /**
    * trigger a simple gesture event, so you can do anything in your handler.
    * only usable if you know what your doing...
    *
    * @class Gesture
    * @static
    */
   /**
    * @event gesture
    * @param {Object} ev
    */
   GestureDetector.gestures.Gesture = {
     name: 'gesture',
     index: 1337,
     handler: function releaseGesture(ev, inst) {
       inst.trigger(this.name, ev);
     }
   };

   /**
    * @module gestures
    */
   /**
    * Touch stays at the same place for x time
    *
    * @class Hold
    * @static
    */
   /**
    * @event hold
    * @param {Object} ev
    */

   /**
    * @param {String} name
    */
   (function (name) {
     var timer;

     function holdGesture(ev, inst) {
       var options = inst.options,
           current = Detection.current;

       switch (ev.eventType) {
         case EVENT_START:
           clearTimeout(timer);

           // set the gesture so we can check in the timeout if it still is
           current.name = name;

           // set timer and if after the timeout it still is hold,
           // we trigger the hold event
           timer = setTimeout(function () {
             if (current && current.name == name) {
               inst.trigger(name, ev);
             }
           }, options.holdTimeout);
           break;

         case EVENT_MOVE:
           if (ev.distance > options.holdThreshold) {
             clearTimeout(timer);
           }
           break;

         case EVENT_RELEASE:
           clearTimeout(timer);
           break;
       }
     }

     GestureDetector.gestures.Hold = {
       name: name,
       index: 10,
       defaults: {
         /**
          * @property holdTimeout
          * @type {Number}
          * @default 500
          */
         holdTimeout: 500,

         /**
          * movement allowed while holding
          * @property holdThreshold
          * @type {Number}
          * @default 2
          */
         holdThreshold: 2
       },
       handler: holdGesture
     };
   })('hold');

   /**
    * @module gestures
    */
   /**
    * when a touch is being released from the page
    *
    * @class Release
    * @static
    */
   /**
    * @event release
    * @param {Object} ev
    */
   GestureDetector.gestures.Release = {
     name: 'release',
     index: Infinity,
     handler: function releaseGesture(ev, inst) {
       if (ev.eventType == EVENT_RELEASE) {
         inst.trigger(this.name, ev);
       }
     }
   };

   /**
    * @module gestures
    */
   /**
    * triggers swipe events when the end velocity is above the threshold
    * for best usage, set `preventDefault` (on the drag gesture) to `true`
    * ````
    *  GestureDetectortime.on("dragleft swipeleft", function(ev) {
    *    console.log(ev);
    *    ev.gesture.preventDefault();
    *  });
    * ````
    *
    * @class Swipe
    * @static
    */
   /**
    * @event swipe
    * @param {Object} ev
    */
   /**
    * @event swipeleft
    * @param {Object} ev
    */
   /**
    * @event swiperight
    * @param {Object} ev
    */
   /**
    * @event swipeup
    * @param {Object} ev
    */
   /**
    * @event swipedown
    * @param {Object} ev
    */
   GestureDetector.gestures.Swipe = {
     name: 'swipe',
     index: 40,
     defaults: {
       /**
        * @property swipeMinTouches
        * @type {Number}
        * @default 1
        */
       swipeMinTouches: 1,

       /**
        * @property swipeMaxTouches
        * @type {Number}
        * @default 1
        */
       swipeMaxTouches: 1,

       /**
        * horizontal swipe velocity
        * @property swipeVelocityX
        * @type {Number}
        * @default 0.6
        */
       swipeVelocityX: 0.6,

       /**
        * vertical swipe velocity
        * @property swipeVelocityY
        * @type {Number}
        * @default 0.6
        */
       swipeVelocityY: 0.6
     },

     handler: function swipeGesture(ev, inst) {
       if (ev.eventType == EVENT_RELEASE) {
         var touches = ev.touches.length,
             options = inst.options;

         // max touches
         if (touches < options.swipeMinTouches || touches > options.swipeMaxTouches) {
           return;
         }

         // when the distance we moved is too small we skip this gesture
         // or we can be already in dragging
         if (ev.velocityX > options.swipeVelocityX || ev.velocityY > options.swipeVelocityY) {
           // trigger swipe events
           inst.trigger(this.name, ev);
           inst.trigger(this.name + ev.direction, ev);
         }
       }
     }
   };

   /**
    * @module gestures
    */
   /**
    * Single tap and a double tap on a place
    *
    * @class Tap
    * @static
    */
   /**
    * @event tap
    * @param {Object} ev
    */
   /**
    * @event doubletap
    * @param {Object} ev
    */

   /**
    * @param {String} name
    */
   (function (name) {
     var hasMoved = false;

     function tapGesture(ev, inst) {
       var options = inst.options,
           current = Detection.current,
           prev = Detection.previous,
           sincePrev,
           didDoubleTap;

       switch (ev.eventType) {
         case EVENT_START:
           hasMoved = false;
           break;

         case EVENT_MOVE:
           hasMoved = hasMoved || ev.distance > options.tapMaxDistance;
           break;

         case EVENT_END:
           if (!Utils.inStr(ev.srcEvent.type, 'cancel') && ev.deltaTime < options.tapMaxTime && !hasMoved) {
             // previous gesture, for the double tap since these are two different gesture detections
             sincePrev = prev && prev.lastEvent && ev.timeStamp - prev.lastEvent.timeStamp;
             didDoubleTap = false;

             // check if double tap
             if (prev && prev.name == name && sincePrev && sincePrev < options.doubleTapInterval && ev.distance < options.doubleTapDistance) {
               inst.trigger('doubletap', ev);
               didDoubleTap = true;
             }

             // do a single tap
             if (!didDoubleTap || options.tapAlways) {
               current.name = name;
               inst.trigger(current.name, ev);
             }
           }
           break;
       }
     }

     GestureDetector.gestures.Tap = {
       name: name,
       index: 100,
       handler: tapGesture,
       defaults: {
         /**
          * max time of a tap, this is for the slow tappers
          * @property tapMaxTime
          * @type {Number}
          * @default 250
          */
         tapMaxTime: 250,

         /**
          * max distance of movement of a tap, this is for the slow tappers
          * @property tapMaxDistance
          * @type {Number}
          * @default 10
          */
         tapMaxDistance: 10,

         /**
          * always trigger the `tap` event, even while double-tapping
          * @property tapAlways
          * @type {Boolean}
          * @default true
          */
         tapAlways: true,

         /**
          * max distance between two taps
          * @property doubleTapDistance
          * @type {Number}
          * @default 20
          */
         doubleTapDistance: 20,

         /**
          * max time between two taps
          * @property doubleTapInterval
          * @type {Number}
          * @default 300
          */
         doubleTapInterval: 300
       }
     };
   })('tap');

   /**
    * @module gestures
    */
   /**
    * when a touch is being touched at the page
    *
    * @class Touch
    * @static
    */
   /**
    * @event touch
    * @param {Object} ev
    */
   GestureDetector.gestures.Touch = {
     name: 'touch',
     index: -Infinity,
     defaults: {
       /**
        * call preventDefault at touchstart, and makes the element blocking by disabling the scrolling of the page,
        * but it improves gestures like transforming and dragging.
        * be careful with using this, it can be very annoying for users to be stuck on the page
        * @property preventDefault
        * @type {Boolean}
        * @default false
        */
       preventDefault: false,

       /**
        * disable mouse events, so only touch (or pen!) input triggers events
        * @property preventMouse
        * @type {Boolean}
        * @default false
        */
       preventMouse: false
     },
     handler: function touchGesture(ev, inst) {
       if (inst.options.preventMouse && ev.pointerType == POINTER_MOUSE) {
         ev.stopDetect();
         return;
       }

       if (inst.options.preventDefault) {
         ev.preventDefault();
       }

       if (ev.eventType == EVENT_TOUCH) {
         inst.trigger('touch', ev);
       }
     }
   };

   /**
    * @module gestures
    */
   /**
    * User want to scale or rotate with 2 fingers
    * Preventing the default browser behavior is a good way to improve feel and working. This can be done with the
    * `preventDefault` option.
    *
    * @class Transform
    * @static
    */
   /**
    * @event transform
    * @param {Object} ev
    */
   /**
    * @event transformstart
    * @param {Object} ev
    */
   /**
    * @event transformend
    * @param {Object} ev
    */
   /**
    * @event pinchin
    * @param {Object} ev
    */
   /**
    * @event pinchout
    * @param {Object} ev
    */
   /**
    * @event rotate
    * @param {Object} ev
    */

   /**
    * @param {String} name
    */
   (function (name) {
     var triggered = false;

     function transformGesture(ev, inst) {
       switch (ev.eventType) {
         case EVENT_START:
           triggered = false;
           break;

         case EVENT_MOVE:
           // at least multitouch
           if (ev.touches.length < 2) {
             return;
           }

           var scaleThreshold = Math.abs(1 - ev.scale);
           var rotationThreshold = Math.abs(ev.rotation);

           // when the distance we moved is too small we skip this gesture
           // or we can be already in dragging
           if (scaleThreshold < inst.options.transformMinScale && rotationThreshold < inst.options.transformMinRotation) {
             return;
           }

           // we are transforming!
           Detection.current.name = name;

           // first time, trigger dragstart event
           if (!triggered) {
             inst.trigger(name + 'start', ev);
             triggered = true;
           }

           inst.trigger(name, ev); // basic transform event

           // trigger rotate event
           if (rotationThreshold > inst.options.transformMinRotation) {
             inst.trigger('rotate', ev);
           }

           // trigger pinch event
           if (scaleThreshold > inst.options.transformMinScale) {
             inst.trigger('pinch', ev);
             inst.trigger('pinch' + (ev.scale < 1 ? 'in' : 'out'), ev);
           }
           break;

         case EVENT_RELEASE:
           if (triggered && ev.changedLength < 2) {
             inst.trigger(name + 'end', ev);
             triggered = false;
           }
           break;
       }
     }

     GestureDetector.gestures.Transform = {
       name: name,
       index: 45,
       defaults: {
         /**
          * minimal scale factor, no scale is 1, zoomin is to 0 and zoomout until higher then 1
          * @property transformMinScale
          * @type {Number}
          * @default 0.01
          */
         transformMinScale: 0.01,

         /**
          * rotation in degrees
          * @property transformMinRotation
          * @type {Number}
          * @default 1
          */
         transformMinRotation: 1
       },

       handler: transformGesture
     };
   })('transform');

   /*
   Copyright 2013-2015 ASIAL CORPORATION

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.

   */

   var softwareKeyboard = new MicroEvent();
   softwareKeyboard._visible = false;

   var onShow = function onShow() {
     softwareKeyboard._visible = true;
     softwareKeyboard.emit('show');
   };

   var onHide = function onHide() {
     softwareKeyboard._visible = false;
     softwareKeyboard.emit('hide');
   };

   var bindEvents = function bindEvents() {
     if (typeof Keyboard !== 'undefined') {
       // https://github.com/martinmose/cordova-keyboard/blob/95f3da3a38d8f8e1fa41fbf40145352c13535a00/README.md
       Keyboard.onshow = onShow;
       Keyboard.onhide = onHide;
       softwareKeyboard.emit('init', { visible: Keyboard.isVisible });

       return true;
     } else if (typeof cordova.plugins !== 'undefined' && typeof cordova.plugins.Keyboard !== 'undefined') {
       // https://github.com/driftyco/ionic-plugins-keyboard/blob/ca27ecf/README.md
       window.addEventListener('native.keyboardshow', onShow);
       window.addEventListener('native.keyboardhide', onHide);
       softwareKeyboard.emit('init', { visible: cordova.plugins.Keyboard.isVisible });

       return true;
     }

     return false;
   };

   var noPluginError = function noPluginError() {
     console.warn('ons-keyboard: Cordova Keyboard plugin is not present.');
   };

   document.addEventListener('deviceready', function () {
     if (!bindEvents()) {
       if (document.querySelector('[ons-keyboard-active]') || document.querySelector('[ons-keyboard-inactive]')) {
         noPluginError();
       }

       softwareKeyboard.on = noPluginError;
     }
   });

   /*
   Copyright 2013-2015 ASIAL CORPORATION

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.

   */

   var create = function create() {

     /**
      * @object ons.orientation
      * @category util
      * @description
      *   [en]Utility methods for orientation detection.[/en]
      *   [ja]画面のオリエンテーション検知のためのユーティリティメソッドを収めているオブジェクトです。[/ja]
      */
     var obj = {
       /**
        * @event change
        * @description
        *   [en]Fired when the device orientation changes.[/en]
        *   [ja]デバイスのオリエンテーションが変化した際に発火します。[/ja]
        * @param {Object} event
        *   [en]Event object.[/en]
        *   [ja]イベントオブジェクトです。[/ja]
        * @param {Boolean} event.isPortrait
        *   [en]Will be true if the current orientation is portrait mode.[/en]
        *   [ja]現在のオリエンテーションがportraitの場合にtrueを返します。[/ja]
        */

       /**
        * @method on
        * @signature on(eventName, listener)
        * @description
        *   [en]Add an event listener.[/en]
        *   [ja]イベントリスナーを追加します。[/ja]
        * @param {String} eventName
        *   [en]Name of the event.[/en]
        *   [ja]イベント名を指定します。[/ja]
        * @param {Function} listener
        *   [en]Function to execute when the event is triggered.[/en]
        *   [ja]このイベントが発火された際に呼び出される関数オブジェクトを指定します。[/ja]
        */

       /**
        * @method once
        * @signature once(eventName, listener)
        * @description
        *  [en]Add an event listener that's only triggered once.[/en]
        *  [ja]一度だけ呼び出されるイベントリスナーを追加します。[/ja]
        * @param {String} eventName
        *   [en]Name of the event.[/en]
        *   [ja]イベント名を指定します。[/ja]
        * @param {Function} listener
        *   [en]Function to execute when the event is triggered.[/en]
        *   [ja]イベントが発火した際に呼び出される関数オブジェクトを指定します。[/ja]
        */

       /**
        * @method off
        * @signature off(eventName, [listener])
        * @description
        *  [en]Remove an event listener. If the listener is not specified all listeners for the event type will be removed.[/en]
        *  [ja]イベントリスナーを削除します。もしイベントリスナーを指定しなかった場合には、そのイベントに紐づく全てのイベントリスナーが削除されます。[/ja]
        * @param {String} eventName
        *   [en]Name of the event.[/en]
        *   [ja]イベント名を指定します。[/ja]
        * @param {Function} listener
        *   [en]Function to execute when the event is triggered.[/en]
        *   [ja]削除するイベントリスナーを指定します。[/ja]
        */

       // actual implementation to detect if whether current screen is portrait or not
       _isPortrait: false,

       /**
        * @method isPortrait
        * @signature isPortrait()
        * @return {Boolean}
        *   [en]Will be true if the current orientation is portrait mode.[/en]
        *   [ja]オリエンテーションがportraitモードの場合にtrueになります。[/ja]
        * @description
        *   [en]Returns whether the current screen orientation is portrait or not.[/en]
        *   [ja]オリエンテーションがportraitモードかどうかを返します。[/ja]
        */
       isPortrait: function isPortrait() {
         return this._isPortrait();
       },

       /**
        * @method isLandscape
        * @signature isLandscape()
        * @return {Boolean}
        *   [en]Will be true if the current orientation is landscape mode.[/en]
        *   [ja]オリエンテーションがlandscapeモードの場合にtrueになります。[/ja]
        * @description
        *   [en]Returns whether the current screen orientation is landscape or not.[/en]
        *   [ja]オリエンテーションがlandscapeモードかどうかを返します。[/ja]
        */
       isLandscape: function isLandscape() {
         return !this.isPortrait();
       },

       _init: function _init() {
         document.addEventListener('DOMContentLoaded', this._onDOMContentLoaded.bind(this), false);

         if ('orientation' in window) {
           window.addEventListener('orientationchange', this._onOrientationChange.bind(this), false);
         } else {
           window.addEventListener('resize', this._onResize.bind(this), false);
         }

         this._isPortrait = function () {
           return window.innerHeight > window.innerWidth;
         };

         return this;
       },

       _onDOMContentLoaded: function _onDOMContentLoaded() {
         this._installIsPortraitImplementation();
         this.emit('change', { isPortrait: this.isPortrait() });
       },

       _installIsPortraitImplementation: function _installIsPortraitImplementation() {
         var isPortrait = window.innerWidth < window.innerHeight;

         if (!('orientation' in window)) {
           this._isPortrait = function () {
             return window.innerHeight > window.innerWidth;
           };
         } else if (window.orientation % 180 === 0) {
           this._isPortrait = function () {
             return Math.abs(window.orientation % 180) === 0 ? isPortrait : !isPortrait;
           };
         } else {
           this._isPortrait = function () {
             return Math.abs(window.orientation % 180) === 90 ? isPortrait : !isPortrait;
           };
         }
       },

       _onOrientationChange: function _onOrientationChange() {
         var _this = this;

         var isPortrait = this._isPortrait();

         // Wait for the dimensions to change because
         // of Android inconsistency.
         var nIter = 0;
         var interval = setInterval(function () {
           nIter++;

           var w = window.innerWidth;
           var h = window.innerHeight;

           if (isPortrait && w <= h || !isPortrait && w >= h) {
             _this.emit('change', { isPortrait: isPortrait });
             clearInterval(interval);
           } else if (nIter === 50) {
             _this.emit('change', { isPortrait: isPortrait });
             clearInterval(interval);
           }
         }, 20);
       },

       // Run on not mobile browser.
       _onResize: function _onResize() {
         this.emit('change', { isPortrait: this.isPortrait() });
       }
     };

     MicroEvent.mixin(obj);

     return obj;
   };

   var orientation = create()._init();

   /**
    * @object ons.notification
    * @category dialog
    * @codepen Qwwxyp
    * @description
    *   [en]Utility methods to create different kinds of alert dialogs. There are three methods available: alert, confirm and prompt.[/en]
    *   [ja]いくつかの種類のアラートダイアログを作成するためのユーティリティメソッドを収めたオブジェクトです。[/ja]
    * @example
    * <script>
    *   ons.notification.alert({
    *     message: 'Hello, world!'
    *   });
    *
    *   // Show a Material Design alert dialog.
    *   ons.notification.alert({
    *    message: 'Hello, world!',
    *    modifier: 'material'
    *   });
    *
    *   ons.notification.confirm({
    *     message: 'Are you ready?',
    *     callback: function(answer) {
    *       // Do something here.
    *     }
    *   });
    *
    *   ons.notification.prompt({
    *     message: 'How old are you?',
    *     callback: function(age) {
    *       ons.notification.alert({
    *         message: 'You are ' + age + ' years old.'
    *       });
    *     });
    *   });
    * </script>
    */
   var notification = {};

   notification._createAlertDialog = function (title, message, buttonLabels, primaryButtonIndex, modifier, animation, id, _callback, messageIsHTML, cancelable, promptDialog, autofocus, placeholder, defaultValue, submitOnEnter, compile) {

     compile = compile || function (object) {
       return object;
     };

     var titleElementHTML = typeof title === 'string' ? '<div class="alert-dialog-title"></div>' : '';

     var dialogElement = util.createElement('\n  <ons-alert-dialog>\n    ' + titleElementHTML + '\n    <div class="alert-dialog-content"></div>\n    <div class="alert-dialog-footer"></div>\n  </ons-alert-dialog>');

     if (id) {
       dialogElement.setAttribute('id', id);
     }

     var titleElement = dialogElement.querySelector('.alert-dialog-title');
     var messageElement = dialogElement.querySelector('.alert-dialog-content');
     var footerElement = dialogElement.querySelector('.alert-dialog-footer');
     var inputElement = undefined,
         result = {};

     result.promise = new Promise(function (resolve, reject) {
       result.resolve = resolve;
       result.reject = reject;
     });

     modifier = modifier || dialogElement.getAttribute('modifier');

     if (typeof title === 'string') {
       titleElement.textContent = title;
     }

     titleElement = null;

     dialogElement.setAttribute('animation', animation);

     if (messageIsHTML) {
       messageElement.innerHTML = message;
     } else {
       messageElement.textContent = message;
     }

     if (promptDialog) {
       inputElement = util.createElement('<input class="text-input" type="text"></input>');

       if (modifier) {
         inputElement.classList.add('text-input--' + modifier);
       }

       inputElement.setAttribute('placeholder', placeholder);
       inputElement.value = defaultValue;
       inputElement.style.width = '100%';
       inputElement.style.marginTop = '10px';

       messageElement.appendChild(inputElement);

       if (submitOnEnter) {
         inputElement.addEventListener('keypress', function (event) {
           if (event.keyCode === 13) {
             dialogElement.hide({
               callback: function callback() {
                 _callback(inputElement.value);
                 result.resolve(inputElement.value);
                 dialogElement.destroy();
                 dialogElement = null;
               }
             });
           }
         }, false);
       }
     }

     document.body.appendChild(dialogElement);

     compile(dialogElement);

     if (buttonLabels.length <= 2) {
       footerElement.classList.add('alert-dialog-footer--one');
     }

     var createButton = function createButton(i) {
       var buttonElement = util.createElement('<button class="alert-dialog-button"></button>');
       buttonElement.appendChild(document.createTextNode(buttonLabels[i]));

       if (i == primaryButtonIndex) {
         buttonElement.classList.add('alert-dialog-button--primal');
       }

       if (buttonLabels.length <= 2) {
         buttonElement.classList.add('alert-dialog-button--one');
       }

       var onClick = function onClick() {
         buttonElement.removeEventListener('click', onClick, false);

         dialogElement.hide({
           callback: function callback() {
             if (promptDialog) {
               _callback(inputElement.value);
               result.resolve(inputElement.value);
             } else {
               _callback(i);
               result.resolve(i);
             }
             dialogElement.destroy();
             dialogElement = inputElement = buttonElement = null;
           }
         });
       };

       buttonElement.addEventListener('click', onClick, false);
       footerElement.appendChild(buttonElement);
     };

     for (var i = 0; i < buttonLabels.length; i++) {
       createButton(i);
     }

     if (cancelable) {
       dialogElement.setCancelable(cancelable);
       dialogElement.addEventListener('cancel', function () {
         if (promptDialog) {
           _callback(null);
           result.reject(null);
         } else {
           _callback(-1);
           result.reject(-1);
         }
         setTimeout(function () {
           dialogElement.destroy();
           dialogElement = null;
           inputElement = null;
         });
       }, false);
     }

     dialogElement.show({
       callback: function callback() {
         if (inputElement && promptDialog && autofocus) {
           inputElement.focus();
         }
       }
     });

     messageElement = footerElement = null;

     if (modifier) {
       dialogElement.setAttribute('modifier', '');
       dialogElement.setAttribute('modifier', modifier);
     }

     return result.promise;
   };

   notification._alertOriginal = function (message) {
     var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

     typeof message === 'string' ? options.message = message : options = message;

     var defaults = {
       buttonLabel: 'OK',
       animation: 'default',
       title: 'Alert',
       callback: function callback() {}
     };

     options = util.extend({}, defaults, options);
     if (!options.message && !options.messageHTML) {
       throw new Error('Alert dialog must contain a message.');
     }

     return notification._createAlertDialog(options.title, options.message || options.messageHTML, [options.buttonLabel], 0, options.modifier, options.animation, options.id, options.callback, !options.message ? true : false, false, false, false, '', '', false, options.compile);
   };

   /**
    * @method alert(options)
    * @param {Object} options
    *   [en]Parameter object.[/en]
    *   [ja]オプションを指定するオブジェクトです。[/ja]
    * @param {String} [options.message]
    *   [en]Alert message.[/en]
    *   [ja]アラートダイアログに表示する文字列を指定します。[/ja]
    * @param {String} [options.messageHTML]
    *   [en]Alert message in HTML.[/en]
    *   [ja]アラートダイアログに表示するHTMLを指定します。[/ja]
    * @param {String} [options.buttonLabel]
    *   [en]Label for confirmation button. Default is "OK".[/en]
    *   [ja]確認ボタンのラベルを指定します。"OK"がデフォルトです。[/ja]
    * @param {String} [options.animation]
    *   [en]Animation name. Available animations are "none", "fade" and "slide".[/en]
    *   [ja]アラートダイアログを表示する際のアニメーション名を指定します。"none", "fade", "slide"のいずれかを指定できます。[/ja]
    * @param {String} [options.id]
    *   [en]ons-alert-dialog element's ID.[/en]
    *   [ja]ons-alert-dialog要素のID。[/ja]
    * @param {String} [options.title]
    *   [en]Dialog title. Default is "Alert".[/en]
    *   [ja]アラートダイアログの上部に表示するタイトルを指定します。"Alert"がデフォルトです。[/ja]
    * @param {String} [options.modifier]
    *   [en]Modifier for the dialog.[/en]
    *   [ja]アラートダイアログのmodifier属性の値を指定します。[/ja]
    * @param {Function} [options.callback]
    *   [en]Function that executes after dialog has been closed.[/en]
    *   [ja]アラートダイアログが閉じられた時に呼び出される関数オブジェクトを指定します。[/ja]
    * @description
    *   [en]
    *     Display an alert dialog to show the user a message.
    *     The content of the message can be either simple text or HTML.
    *     Must specify either message or messageHTML.
    *   [/en]
    *   [ja]
    *     ユーザーへメッセージを見せるためのアラートダイアログを表示します。
    *     表示するメッセージは、テキストかもしくはHTMLを指定できます。
    *     このメソッドの引数には、options.messageもしくはoptions.messageHTMLのどちらかを必ず指定する必要があります。
    *   [/ja]
    */
   notification.alert = notification._alertOriginal;

   notification._confirmOriginal = function (options) {
     var defaults = {
       buttonLabels: ['Cancel', 'OK'],
       primaryButtonIndex: 1,
       animation: 'default',
       title: 'Confirm',
       callback: function callback() {},
       cancelable: false
     };

     options = util.extend({}, defaults, options);

     if (!options.message && !options.messageHTML) {
       throw new Error('Confirm dialog must contain a message.');
     }

     return notification._createAlertDialog(options.title, options.message || options.messageHTML, options.buttonLabels, options.primaryButtonIndex, options.modifier, options.animation, options.id, options.callback, !options.message ? true : false, options.cancelable, false, false, '', '', false, options.compile);
   };

   /**
    * @method confirm
    * @signature confirm(options)
    * @param {Object} options
    *   [en]Parameter object.[/en]
    * @param {String} [options.message]
    *   [en]Confirmation question.[/en]
    *   [ja]確認ダイアログに表示するメッセージを指定します。[/ja]
    * @param {String} [options.messageHTML]
    *   [en]Dialog content in HTML.[/en]
    *   [ja]確認ダイアログに表示するHTMLを指定します。[/ja]
    * @param {Array} [options.buttonLabels]
    *   [en]Labels for the buttons. Default is ["Cancel", "OK"].[/en]
    *   [ja]ボタンのラベルの配列を指定します。["Cancel", "OK"]がデフォルトです。[/ja]
    * @param {Number} [options.primaryButtonIndex]
    *   [en]Index of primary button. Default is 1.[/en]
    *   [ja]プライマリボタンのインデックスを指定します。デフォルトは 1 です。[/ja]
    * @param {Boolean} [options.cancelable]
    *   [en]Whether the dialog is cancelable or not. Default is false.[/en]
    *   [ja]ダイアログがキャンセル可能かどうかを指定します。[/ja]
    * @param {String} [options.animation]
    *   [en]Animation name. Available animations are "none", "fade" and "slide".[/en]
    *   [ja]アニメーション名を指定します。"none", "fade", "slide"のいずれかを指定します。[/ja]
    * @param {String} [options.id]
    *   [en]ons-alert-dialog element's ID.[/en]
    *   [ja]ons-alert-dialog要素のID。[/ja]
    * @param {String} [options.title]
    *   [en]Dialog title. Default is "Confirm".[/en]
    *   [ja]ダイアログのタイトルを指定します。"Confirm"がデフォルトです。[/ja]
    * @param {String} [options.modifier]
    *   [en]Modifier for the dialog.[/en]
    *   [ja]ダイアログのmodifier属性の値を指定します。[/ja]
    * @param {Function} [options.callback]
    *   [en]
    *     Function that executes after the dialog has been closed.
    *     Argument for the function is the index of the button that was pressed or -1 if the dialog was canceled.
    *   [/en]
    *   [ja]
    *     ダイアログが閉じられた後に呼び出される関数オブジェクトを指定します。
    *     この関数の引数として、押されたボタンのインデックス値が渡されます。
    *     もしダイアログがキャンセルされた場合には-1が渡されます。
    *   [/ja]
    * @description
    *   [en]
    *     Display a dialog to ask the user for confirmation.
    *     The default button labels are "Cancel" and "OK" but they can be customized.
    *     Must specify either message or messageHTML.
    *   [/en]
    *   [ja]
    *     ユーザに確認を促すダイアログを表示します。
    *     デオルとのボタンラベルは、"Cancel"と"OK"ですが、これはこのメソッドの引数でカスタマイズできます。
    *     このメソッドの引数には、options.messageもしくはoptions.messageHTMLのどちらかを必ず指定する必要があります。
    *   [/ja]
    */
   notification.confirm = notification._confirmOriginal;

   notification._promptOriginal = function (options) {
     var defaults = {
       buttonLabel: 'OK',
       animation: 'default',
       title: 'Alert',
       defaultValue: '',
       placeholder: '',
       callback: function callback() {},
       cancelable: false,
       autofocus: true,
       submitOnEnter: true
     };

     options = util.extend({}, defaults, options);
     if (!options.message && !options.messageHTML) {
       throw new Error('Prompt dialog must contain a message.');
     }

     return notification._createAlertDialog(options.title, options.message || options.messageHTML, [options.buttonLabel], 0, options.modifier, options.animation, options.id, options.callback, !options.message ? true : false, options.cancelable, true, options.autofocus, options.placeholder, options.defaultValue, options.submitOnEnter, options.compile);
   };

   /**
    * @method prompt
    * @signature prompt(options)
    * @return {Promise}
    * @param {Object} options
    *   [en]Parameter object.[/en]
    *   [ja]オプションを指定するオブジェクトです。[/ja]
    * @param {String} [options.message]
    *   [en]Prompt question.[/en]
    *   [ja]ダイアログに表示するメッセージを指定します。[/ja]
    * @param {String} [options.messageHTML]
    *   [en]Dialog content in HTML.[/en]
    *   [ja]ダイアログに表示するHTMLを指定します。[/ja]
    * @param {String} [options.buttonLabel]
    *   [en]Label for confirmation button. Default is "OK".[/en]
    *   [ja]確認ボタンのラベルを指定します。"OK"がデフォルトです。[/ja]
    * @param {Number} [options.primaryButtonIndex]
    *   [en]Index of primary button. Default is 1.[/en]
    *   [ja]プライマリボタンのインデックスを指定します。デフォルトは 1 です。[/ja]
    * @param {Boolean} [options.cancelable]
    *   [en]Whether the dialog is cancelable or not. Default is false.[/en]
    *   [ja]ダイアログがキャンセル可能かどうかを指定します。デフォルトは false です。[/ja]
    * @param {String} [options.animation]
    *   [en]Animation name. Available animations are "none", "fade" and "slide".[/en]
    *   [ja]アニメーション名を指定します。"none", "fade", "slide"のいずれかを指定します。[/ja]
    * @param {String} [options.id]
    *   [en]ons-alert-dialog element's ID.[/en]
    *   [ja]ons-alert-dialog要素のID。[/ja]
    * @param {String} [options.title]
    *   [en]Dialog title. Default is "Alert".[/en]
    *   [ja]ダイアログのタイトルを指定します。デフォルトは "Alert" です。[/ja]
    * @param {String} [options.placeholder]
    *   [en]Placeholder for the text input.[/en]
    *   [ja]テキスト欄のプレースホルダに表示するテキストを指定します。[/ja]
    * @param {String} [options.defaultValue]
    *   [en]Default value for the text input.[/en]
    *   [ja]テキスト欄のデフォルトの値を指定します。[/ja]
    * @param {Boolean} [options.autofocus]
    *   [en]Autofocus the input element. Default is true.[/en]
    *   [ja]input要素に自動的にフォーカスするかどうかを指定します。デフォルトはtrueです。[/ja]
    * @param {String} [options.modifier]
    *   [en]Modifier for the dialog.[/en]
    *   [ja]ダイアログのmodifier属性の値を指定します。[/ja]
    * @param {Function} [options.callback]
    *   [en]
    *     Function that executes after the dialog has been closed.
    *     Argument for the function is the value of the input field or null if the dialog was canceled.
    *   [/en]
    *   [ja]
    *     ダイアログが閉じられた後に実行される関数オブジェクトを指定します。
    *     関数の引数として、インプット要素の中の値が渡されます。ダイアログがキャンセルされた場合には、nullが渡されます。
    *   [/ja]
    * @param {Boolean} [options.submitOnEnter]
    *   [en]Submit automatically when enter is pressed. Default is "true".[/en]
    *   [ja]Enterが押された際にそのformをsubmitするかどうかを指定します。デフォルトはtrueです。[/ja]
    * @description
    *   [en]
    *     Display a dialog with a prompt to ask the user a question.
    *     Must specify either message or messageHTML.
    *   [/en]
    *   [ja]
    *     ユーザーに入力を促すダイアログを表示します。
    *     このメソッドの引数には、options.messageもしくはoptions.messageHTMLのどちらかを必ず指定する必要があります。
    *   [/ja]
    */
   notification.prompt = notification._promptOriginal;

   var autoStyleEnabled = true;

   var platforms = {};

   platforms.android = function (element) {

     // Modifiers
     var modifiersMap = {
       'quiet': 'material--flat',
       'light': 'material--flat',
       'outline': 'material--flat',
       'cta': '',
       'large--quiet': 'material--flat large',
       'large--cta': 'large',
       'noborder': '',
       'chevron': '',
       'tappable': '',
       'underbar': ''
     };

     if (!/ons-fab|ons-speed-dial|ons-progress/.test(element.tagName.toLowerCase()) && !/material/.test(element.getAttribute('modifier'))) {

       var oldModifier = element.getAttribute('modifier') || '';

       var newModifier = oldModifier.trim().split(/\s+/).map(function (e) {
         return modifiersMap.hasOwnProperty(e) ? modifiersMap[e] : e;
       });
       newModifier.unshift('material');

       element.setAttribute('modifier', newModifier.join(' ').trim());
     }

     // Effects
     if (/ons-button|ons-list-item|ons-fab|ons-speed-dial-item|ons-tab$/.test(element.tagName.toLowerCase()) && !element.hasAttribute('ripple') && !util.findChild(element, 'ons-ripple')) {

       if (element.tagName.toLowerCase() === 'ons-list-item') {
         if (element.hasAttribute('tappable')) {
           element.setAttribute('ripple', '');
           element.removeAttribute('tappable');
         }
       } else {
         element.setAttribute('ripple', '');
       }
     }
   };

   var prepareAutoStyle = function prepareAutoStyle(element) {
     if (autoStyleEnabled && !element.hasAttribute('disable-auto-styling')) {
       var mobileOS = platform.getMobileOS();
       if (platforms.hasOwnProperty(mobileOS)) {
         platforms[mobileOS](element);
       }
     }
   };

   var autoStyle = {
     isEnabled: function isEnabled() {
       return autoStyleEnabled;
     },
     enable: function enable() {
       return autoStyleEnabled = true;
     },
     disable: function disable() {
       return autoStyleEnabled = false;
     },
     prepare: prepareAutoStyle
   };

   var generateId = (function () {
     var i = 0;
     return function () {
       return i++;
     };
   })();

   /**
    * Door locking system.
    *
    * @param {Object} [options]
    * @param {Function} [options.log]
    */

   var DoorLock = (function () {
     function DoorLock() {
       var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];
       babelHelpers.classCallCheck(this, DoorLock);

       this._lockList = [];
       this._waitList = [];
       this._log = options.log || function () {};
     }

     /**
      * Register a lock.
      *
      * @return {Function} Callback for unlocking.
      */

     babelHelpers.createClass(DoorLock, [{
       key: 'lock',
       value: function lock() {
         var _this = this;

         var unlock = function unlock() {
           _this._unlock(unlock);
         };
         unlock.id = generateId();
         this._lockList.push(unlock);
         this._log('lock: ' + unlock.id);

         return unlock;
       }
     }, {
       key: '_unlock',
       value: function _unlock(fn) {
         var index = this._lockList.indexOf(fn);
         if (index === -1) {
           throw new Error('This function is not registered in the lock list.');
         }

         this._lockList.splice(index, 1);
         this._log('unlock: ' + fn.id);

         this._tryToFreeWaitList();
       }
     }, {
       key: '_tryToFreeWaitList',
       value: function _tryToFreeWaitList() {
         while (!this.isLocked() && this._waitList.length > 0) {
           this._waitList.shift()();
         }
       }

       /**
        * Register a callback for waiting unlocked door.
        *
        * @params {Function} callback Callback on unlocking the door completely.
        */

     }, {
       key: 'waitUnlock',
       value: function waitUnlock(callback) {
         if (!(callback instanceof Function)) {
           throw new Error('The callback param must be a function.');
         }

         if (this.isLocked()) {
           this._waitList.push(callback);
         } else {
           callback();
         }
       }

       /**
        * @return {Boolean}
        */

     }, {
       key: 'isLocked',
       value: function isLocked() {
         return this._lockList.length > 0;
       }
     }]);
     return DoorLock;
   })();

   /**
    * @object ons
    * @category util
    * @description
    *   [ja]Onsen UIで利用できるグローバルなオブジェクトです。[/ja]
    *   [en]A global object that's used in Onsen UI. [/en]
    */
   var ons$1 = {};

   ons$1._util = util;
   ons$1._deviceBackButtonDispatcher = deviceBackButtonDispatcher;
   ons$1._internal = internal;
   ons$1.GestureDetector = GestureDetector;
   ons$1.platform = platform;
   ons$1.softwareKeyboard = softwareKeyboard;
   ons$1.pageAttributeExpression = pageAttributeExpression;
   ons$1.orientation = orientation;
   ons$1.notification = notification;
   ons$1._animationOptionsParser = parse;
   ons$1._autoStyle = autoStyle;
   ons$1._DoorLock = DoorLock;

   ons$1._readyLock = new DoorLock();

   ons$1._config = {
     autoStatusBarFill: true,
     animationsDisabled: false
   };

   waitDeviceReady();

   /**
    * @method isReady
    * @signature isReady()
    * @return {Boolean}
    *   [en]Will be true if Onsen UI is initialized.[/en]
    *   [ja]初期化されているかどうかを返します。[/ja]
    * @description
    *   [en]Returns true if Onsen UI is initialized.[/en]
    *   [ja]Onsen UIがすでに初期化されているかどうかを返すメソッドです。[/ja]
    */
   ons$1.isReady = function () {
     return !ons$1._readyLock.isLocked();
   };

   /**
    * @method isWebView
    * @signature isWebView()
    * @return {Boolean}
    *   [en]Will be true if the app is running in Cordova.[/en]
    *   [ja]Cordovaで実行されている場合にtrueになります。[/ja]
    * @description
    *   [en]Returns true if running inside Cordova.[/en]
    *   [ja]Cordovaで実行されているかどうかを返すメソッドです。[/ja]
    */
   ons$1.isWebView = function () {
     if (document.readyState === 'loading' || document.readyState == 'uninitialized') {
       throw new Error('isWebView() method is available after dom contents loaded.');
     }

     return !!(window.cordova || window.phonegap || window.PhoneGap);
   };

   /**
    * @method ready
    * @signature ready(callback)
    * @description
    *   [ja]アプリの初期化に利用するメソッドです。渡された関数は、Onsen UIの初期化が終了している時点で必ず呼ばれます。[/ja]
    *   [en]Method used to wait for app initialization. The callback will not be executed until Onsen UI has been completely initialized.[/en]
    * @param {Function} callback
    *   [en]Function that executes after Onsen UI has been initialized.[/en]
    *   [ja]Onsen UIが初期化が完了した後に呼び出される関数オブジェクトを指定します。[/ja]
    */
   ons$1.ready = function (callback) {
     if (ons$1.isReady()) {
       callback();
     } else {
       ons$1._readyLock.waitUnlock(callback);
     }
   };

   /**
    * @method setDefaultDeviceBackButtonListener
    * @signature setDefaultDeviceBackButtonListener(listener)
    * @param {Function} listener
    *   [en]Function that executes when device back button is pressed.[/en]
    *   [ja]デバイスのバックボタンが押された時に実行される関数オブジェクトを指定します。[/ja]
    * @description
    *   [en]Set default handler for device back button.[/en]
    *   [ja]デバイスのバックボタンのためのデフォルトのハンドラを設定します。[/ja]
    */
   ons$1.setDefaultDeviceBackButtonListener = function (listener) {
     ons$1._defaultDeviceBackButtonHandler.setListener(listener);
   };

   /**
    * @method disableDeviceBackButtonHandler
    * @signature disableDeviceBackButtonHandler()
    * @description
    * [en]Disable device back button event handler.[/en]
    * [ja]デバイスのバックボタンのイベントを受け付けないようにします。[/ja]
    */
   ons$1.disableDeviceBackButtonHandler = function () {
     ons$1._deviceBackButtonDispatcher.disable();
   };

   /**
    * @method enableDeviceBackButtonHandler
    * @signature enableDeviceBackButtonHandler()
    * @description
    * [en]Enable device back button event handler.[/en]
    * [ja]デバイスのバックボタンのイベントを受け付けるようにします。[/ja]
    */
   ons$1.enableDeviceBackButtonHandler = function () {
     ons$1._deviceBackButtonDispatcher.enable();
   };

   /**
    * @method enableAutoStatusBarFill
    * @signature enableAutoStatusBarFill()
    * @description
    *   [en]Enable status bar fill feature on iOS7 and above.[/en]
    *   [ja]iOS7以上で、ステータスバー部分の高さを自動的に埋める処理を有効にします。[/ja]
    */
   ons$1.enableAutoStatusBarFill = function () {
     if (ons$1.isReady()) {
       throw new Error('This method must be called before ons.isReady() is true.');
     }
     ons$1._config.autoStatusBarFill = true;
   };

   /**
    * @method disableAutoStatusBarFill
    * @signature disableAutoStatusBarFill()
    * @description
    *   [en]Disable status bar fill feature on iOS7 and above.[/en]
    *   [ja]iOS7以上で、ステータスバー部分の高さを自動的に埋める処理を無効にします。[/ja]
    */
   ons$1.disableAutoStatusBarFill = function () {
     if (ons$1.isReady()) {
       throw new Error('This method must be called before ons.isReady() is true.');
     }
     ons$1._config.autoStatusBarFill = false;
   };

   /**
    * @method disableAnimations
    * @signature disableAnimations()
    * @description
    *   [en]Disable all animations. Could be handy for testing and older devices.[/en]
    *   [ja]アニメーションを全て無効にします。テストの際に便利です。[/ja]
    */
   ons$1.disableAnimations = function () {
     ons$1._config.animationsDisabled = true;
   };

   /**
    * @method enableAnimations
    * @signature enableAnimations()
    * @description
    *   [en]Enable animations (default).[/en]
    *   [ja]アニメーションを有効にします。[/ja]
    */
   ons$1.enableAnimations = function () {
     ons$1._config.animationsDisabled = false;
   };

   /**
    * Disable automatic styling.
    */
   ons$1.disableAutoStyling = ons$1._autoStyle.disable;

   /**
    * Enable automatic styling based on OS (default).
    */
   ons$1.enableAutoStyling = ons$1._autoStyle.enable;

   /**
    * @param {String} page
    * @param {Object} [options]
    * @param {Function} [options.link]
    * @return {Promise}
    */
   ons$1._createPopoverOriginal = function (page) {
     var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

     if (!page) {
       throw new Error('Page url must be defined.');
     }

     return ons$1._internal.getPageHTMLAsync(page).then(function (html) {
       html = html.match(/<ons-popover/gi) ? '<div>' + html + '</div>' : '<ons-popover>' + html + '</ons-popover>';
       var div = ons$1._util.createElement('<div>' + html + '</div>');

       var popover = div.querySelector('ons-popover');
       CustomElements.upgrade(popover);
       document.body.appendChild(popover);

       if (options.link instanceof Function) {
         options.link(popover);
       }

       return popover;
     });
   };

   /**
    * @method createPopover
    * @signature createPopover(page, [options])
    * @param {String} page
    *   [en]Page name. Can be either an HTML file or an <ons-template> containing a <ons-dialog> component.[/en]
    *   [ja]pageのURLか、もしくはons-templateで宣言したテンプレートのid属性の値を指定できます。[/ja]
    * @param {Object} [options]
    *   [en]Parameter object.[/en]
    *   [ja]オプションを指定するオブジェクト。[/ja]
    * @param {Object} [options.parentScope]
    *   [en]Parent scope of the dialog. Used to bind models and access scope methods from the dialog.[/en]
    *   [ja]ダイアログ内で利用する親スコープを指定します。ダイアログからモデルやスコープのメソッドにアクセスするのに使います。このパラメータはAngularJSバインディングでのみ利用できます。[/ja]
    * @return {Promise}
    *   [en]Promise object that resolves to the popover component object.[/en]
    *   [ja]ポップオーバーのコンポーネントオブジェクトを解決するPromiseオブジェクトを返します。[/ja]
    * @description
    *   [en]Create a popover instance from a template.[/en]
    *   [ja]テンプレートからポップオーバーのインスタンスを生成します。[/ja]
    */
   ons$1.createPopover = ons$1._createPopoverOriginal;

   /**
    * @param {String} page
    * @param {Object} [options]
    * @param {Function} [options.link]
    * @return {Promise}
    */
   ons$1._createDialogOriginal = function (page) {
     var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

     if (!page) {
       throw new Error('Page url must be defined.');
     }

     return ons$1._internal.getPageHTMLAsync(page).then(function (html) {
       html = html.match(/<ons-dialog/gi) ? '<div>' + html + '</div>' : '<ons-dialog>' + html + '</ons-dialog>';
       var div = ons$1._util.createElement('<div>' + html + '</div>');

       var dialog = div.querySelector('ons-dialog');
       CustomElements.upgrade(dialog);
       document.body.appendChild(dialog);

       if (options.link instanceof Function) {
         options.link(dialog);
       }

       return dialog;
     });
   };

   /**
    * @method createDialog
    * @signature createDialog(page, [options])
    * @param {String} page
    *   [en]Page name. Can be either an HTML file or an <ons-template> containing a <ons-dialog> component.[/en]
    *   [ja]pageのURLか、もしくはons-templateで宣言したテンプレートのid属性の値を指定できます。[/ja]
    * @param {Object} [options]
    *   [en]Parameter object.[/en]
    *   [ja]オプションを指定するオブジェクト。[/ja]
    * @return {Promise}
    *   [en]Promise object that resolves to the dialog component object.[/en]
    *   [ja]ダイアログのコンポーネントオブジェクトを解決するPromiseオブジェクトを返します。[/ja]
    * @description
    *   [en]Create a dialog instance from a template.[/en]
    *   [ja]テンプレートからダイアログのインスタンスを生成します。[/ja]
    */
   ons$1.createDialog = ons$1._createDialogOriginal;

   /**
    * @param {String} page
    * @param {Object} [options]
    * @param {Function} [options.link]
    * @return {Promise}
    */
   ons$1._createAlertDialogOriginal = function (page) {
     var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

     if (!page) {
       throw new Error('Page url must be defined.');
     }

     return ons$1._internal.getPageHTMLAsync(page).then(function (html) {
       html = html.match(/<ons-alert-dialog/gi) ? '<div>' + html + '</div>' : '<ons-alert-dialog>' + html + '</ons-alert-dialog>';
       var div = ons$1._util.createElement('<div>' + html + '</div>');

       var alertDialog = div.querySelector('ons-alert-dialog');
       CustomElements.upgrade(alertDialog);
       document.body.appendChild(alertDialog);

       if (options.link instanceof Function) {
         options.link(alertDialog);
       }

       return alertDialog;
     });
   };

   /**
    * @method createAlertDialog
    * @signature createAlertDialog(page, [options])
    * @param {String} page
    *   [en]Page name. Can be either an HTML file or an <ons-template> containing a <ons-alert-dialog> component.[/en]
    *   [ja]pageのURLか、もしくはons-templateで宣言したテンプレートのid属性の値を指定できます。[/ja]
    * @param {Object} [options]
    *   [en]Parameter object.[/en]
    *   [ja]オプションを指定するオブジェクト。[/ja]
    * @return {Promise}
    *   [en]Promise object that resolves to the alert dialog component object.[/en]
    *   [ja]ダイアログのコンポーネントオブジェクトを解決するPromiseオブジェクトを返します。[/ja]
    * @description
    *   [en]Create a alert dialog instance from a template.[/en]
    *   [ja]テンプレートからアラートダイアログのインスタンスを生成します。[/ja]
    */
   ons$1.createAlertDialog = ons$1._createAlertDialogOriginal;

   /**
    * @param {String} page
    * @param {Function} link
    */
   ons$1._resolveLoadingPlaceholderOriginal = function (page, link) {
     var elements = ons$1._util.arrayFrom(window.document.querySelectorAll('[ons-loading-placeholder]'));

     if (elements.length > 0) {
       elements.filter(function (element) {
         return !element.getAttribute('page');
       }).forEach(function (element) {
         element.setAttribute('ons-loading-placeholder', page);
         ons$1._resolveLoadingPlaceholder(element, page, link);
       });
     } else {
       throw new Error('No ons-loading-placeholder exists.');
     }
   };

   /**
    * @method resolveLoadingPlaceholder
    * @signature resolveLoadingPlaceholder(page)
    * @param {String} page
    *   [en]Page name. Can be either an HTML file or an <ons-template> element.[/en]
    *   [ja]pageのURLか、もしくはons-templateで宣言したテンプレートのid属性の値を指定できます。[/ja]
    * @description
    *   [en]If no page is defined for the `ons-loading-placeholder` attribute it will wait for this method being called before loading the page.[/en]
    *   [ja]ons-loading-placeholderの属性値としてページが指定されていない場合は、ページロード前に呼ばれるons.resolveLoadingPlaceholder処理が行われるまで表示されません。[/ja]
    */
   ons$1.resolveLoadingPlaceholder = ons$1._resolveLoadingPlaceholderOriginal;

   ons$1._setupLoadingPlaceHolders = function () {
     ons$1.ready(function () {
       var elements = ons$1._util.arrayFrom(window.document.querySelectorAll('[ons-loading-placeholder]'));

       elements.forEach(function (element) {
         var page = element.getAttribute('ons-loading-placeholder');
         if (typeof page === 'string') {
           ons$1._resolveLoadingPlaceholder(element, page);
         }
       });
     });
   };

   ons$1._resolveLoadingPlaceholder = function (element, page, link) {
     link = link || function (element, done) {
       done();
     };
     ons$1._internal.getPageHTMLAsync(page).then(function (html) {

       while (element.firstChild) {
         element.removeChild(element.firstChild);
       }

       var contentElement = ons$1._util.createElement('<div>' + html + '</div>');
       contentElement.style.display = 'none';

       element.appendChild(contentElement);

       link(contentElement, function () {
         contentElement.style.display = '';
       });
     }).catch(function (error) {
       throw new Error('Unabled to resolve placeholder: ' + error);
     });
   };

   function waitDeviceReady() {
     var unlockDeviceReady = ons$1._readyLock.lock();
     window.addEventListener('DOMContentLoaded', function () {
       if (ons$1.isWebView()) {
         window.document.addEventListener('deviceready', unlockDeviceReady, false);
       } else {
         unlockDeviceReady();
       }
     }, false);
   }

   /*
   Copyright 2013-2015 ASIAL CORPORATION

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.

   */

   var BaseElement = (function () {
     if (typeof HTMLElement !== 'function') {
       var BaseElement = function BaseElement() {};
       BaseElement.prototype = document.createElement('div');
       return BaseElement;
     } else {
       return HTMLElement;
     }
   })();

   /**
    * @element ons-template
    * @category util
    * @description
    *   [en]Define a separate HTML fragment and use as a template.[/en]
    *   [ja]テンプレートとして使用するためのHTMLフラグメントを定義します。この要素でHTMLを宣言すると、id属性に指定した名前をpageのURLとしてons-navigatorなどのコンポーネントから参照できます。[/ja]
    * @guide DefiningMultiplePagesinSingleHTML
    *   [en]Defining multiple pages in single html[/en]
    *   [ja]複数のページを1つのHTMLに記述する[/ja]
    * @example
    * <ons-template id="foobar.html">
    *   ...
    * </ons-template>
    */

   var TemplateElement = (function (_BaseElement) {
     babelHelpers.inherits(TemplateElement, _BaseElement);

     function TemplateElement() {
       babelHelpers.classCallCheck(this, TemplateElement);
       return babelHelpers.possibleConstructorReturn(this, Object.getPrototypeOf(TemplateElement).apply(this, arguments));
     }

     babelHelpers.createClass(TemplateElement, [{
       key: 'createdCallback',
       value: function createdCallback() {
         this.template = this.innerHTML;

         while (this.firstChild) {
           this.removeChild(this.firstChild);
         }
       }
     }, {
       key: 'attachedCallback',
       value: function attachedCallback() {
         var event = new CustomEvent('_templateloaded', { bubbles: true, cancelable: true });
         event.template = this.template;
         event.templateId = this.getAttribute('id');

         this.dispatchEvent(event);
       }
     }]);
     return TemplateElement;
   })(BaseElement);

   window.OnsTemplateElement = document.registerElement('ons-template', {
     prototype: TemplateElement.prototype
   });

   var ConditionalElement = (function (_BaseElement) {
     babelHelpers.inherits(ConditionalElement, _BaseElement);

     function ConditionalElement() {
       babelHelpers.classCallCheck(this, ConditionalElement);
       return babelHelpers.possibleConstructorReturn(this, Object.getPrototypeOf(ConditionalElement).apply(this, arguments));
     }

     babelHelpers.createClass(ConditionalElement, [{
       key: 'createdCallback',
       value: function createdCallback() {
         this._isAllowedPlatform = !this.getAttribute('platform') || this.getAttribute('platform').split(/\s+/).indexOf(ons.platform.getMobileOS()) >= 0;

         if (this._isAllowedPlatform) {
           this._onOrientationChange();
         } else {
           this.innerHTML = '';
         }
       }
     }, {
       key: 'attachedCallback',
       value: function attachedCallback() {
         if (this._isAllowedPlatform) {
           ons.orientation.on('change', this._onOrientationChange.bind(this));
         }
       }
     }, {
       key: 'attributeChangedCallback',
       value: function attributeChangedCallback(name) {
         if (name === 'orientation') {
           this._onOrientationChange();
         }
       }
     }, {
       key: 'detachedCallback',
       value: function detachedCallback() {
         ons.orientation.off('change', this._onOrientationChange);
       }
     }, {
       key: '_onOrientationChange',
       value: function _onOrientationChange() {
         if (this.hasAttribute('orientation')) {
           var conditionalOrientation = this.getAttribute('orientation').toLowerCase();
           var currentOrientation = ons.orientation.isPortrait() ? 'portrait' : 'landscape';

           if (conditionalOrientation === currentOrientation) {
             this.style.display = '';
           } else {
             this.style.display = 'none';
           }
         }
       }
     }]);
     return ConditionalElement;
   })(BaseElement);

   window.OnsConditionalElement = document.registerElement('ons-if', {
     prototype: ConditionalElement.prototype
   });

   /*
   Copyright 2013-2015 ASIAL CORPORATION

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.

   */

   var AlertDialogAnimator = (function () {
     function AlertDialogAnimator() {
       var _ref = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

       var _ref$timing = _ref.timing;
       var timing = _ref$timing === undefined ? 'linear' : _ref$timing;
       var _ref$delay = _ref.delay;
       var delay = _ref$delay === undefined ? 0 : _ref$delay;
       var _ref$duration = _ref.duration;
       var duration = _ref$duration === undefined ? 0.2 : _ref$duration;
       babelHelpers.classCallCheck(this, AlertDialogAnimator);

       this.timing = timing;
       this.delay = delay;
       this.duration = duration;
     }

     /**
      * @param {HTMLElement} dialog
      * @param {Function} done
      */

     babelHelpers.createClass(AlertDialogAnimator, [{
       key: 'show',
       value: function show(dialog, done) {
         done();
       }

       /**
        * @param {HTMLElement} dialog
        * @param {Function} done
        */

     }, {
       key: 'hide',
       value: function hide(dialog, done) {
         done();
       }
     }]);
     return AlertDialogAnimator;
   })();

   /**
    * Android style animator for alert dialog.
    */
   var AndroidAlertDialogAnimator = (function (_AlertDialogAnimator) {
     babelHelpers.inherits(AndroidAlertDialogAnimator, _AlertDialogAnimator);

     function AndroidAlertDialogAnimator() {
       var _ref2 = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

       var _ref2$timing = _ref2.timing;
       var timing = _ref2$timing === undefined ? 'cubic-bezier(.1, .7, .4, 1)' : _ref2$timing;
       var _ref2$duration = _ref2.duration;
       var duration = _ref2$duration === undefined ? 0.2 : _ref2$duration;
       var _ref2$delay = _ref2.delay;
       var delay = _ref2$delay === undefined ? 0 : _ref2$delay;
       babelHelpers.classCallCheck(this, AndroidAlertDialogAnimator);
       return babelHelpers.possibleConstructorReturn(this, Object.getPrototypeOf(AndroidAlertDialogAnimator).call(this, { duration: duration, timing: timing, delay: delay }));
     }

     /**
      * @param {Object} dialog
      * @param {Function} callback
      */

     babelHelpers.createClass(AndroidAlertDialogAnimator, [{
       key: 'show',
       value: function show(dialog, callback) {
         callback = callback ? callback : function () {};

         animit.runAll(animit(dialog._mask).queue({
           opacity: 0
         }).wait(this.delay).queue({
           opacity: 1.0
         }, {
           duration: this.duration,
           timing: this.timing
         }), animit(dialog._dialog).saveStyle().queue({
           css: {
             transform: 'translate3d(-50%, -50%, 0) scale3d(0.9, 0.9, 1.0)',
             opacity: 0.0
           },
           duration: 0
         }).wait(this.delay).queue({
           css: {
             transform: 'translate3d(-50%, -50%, 0) scale3d(1.0, 1.0, 1.0)',
             opacity: 1.0
           },
           duration: this.duration,
           timing: this.timing
         }).restoreStyle().queue(function (done) {
           callback();
           done();
         }));
       }

       /**
        * @param {Object} dialog
        * @param {Function} callback
        */

     }, {
       key: 'hide',
       value: function hide(dialog, callback) {
         callback = callback ? callback : function () {};

         animit.runAll(animit(dialog._mask).queue({
           opacity: 1.0
         }).wait(this.delay).queue({
           opacity: 0
         }, {
           duration: this.duration,
           timing: this.timing
         }), animit(dialog._dialog).saveStyle().queue({
           css: {
             transform: 'translate3d(-50%, -50%, 0) scale3d(1.0, 1.0, 1.0)',
             opacity: 1.0
           },
           duration: 0
         }).wait(this.delay).queue({
           css: {
             transform: 'translate3d(-50%, -50%, 0) scale3d(0.9, 0.9, 1.0)',
             opacity: 0.0
           },
           duration: this.duration,
           timing: this.timing
         }).restoreStyle().queue(function (done) {
           callback();
           done();
         }));
       }
     }]);
     return AndroidAlertDialogAnimator;
   })(AlertDialogAnimator);

   /**
    * iOS style animator for alert dialog.
    */
   var IOSAlertDialogAnimator = (function (_AlertDialogAnimator2) {
     babelHelpers.inherits(IOSAlertDialogAnimator, _AlertDialogAnimator2);

     function IOSAlertDialogAnimator() {
       var _ref3 = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

       var _ref3$timing = _ref3.timing;
       var timing = _ref3$timing === undefined ? 'cubic-bezier(.1, .7, .4, 1)' : _ref3$timing;
       var _ref3$duration = _ref3.duration;
       var duration = _ref3$duration === undefined ? 0.2 : _ref3$duration;
       var _ref3$delay = _ref3.delay;
       var delay = _ref3$delay === undefined ? 0 : _ref3$delay;
       babelHelpers.classCallCheck(this, IOSAlertDialogAnimator);
       return babelHelpers.possibleConstructorReturn(this, Object.getPrototypeOf(IOSAlertDialogAnimator).call(this, { duration: duration, timing: timing, delay: delay }));
     }

     /*
      * @param {Object} dialog
      * @param {Function} callback
      */

     babelHelpers.createClass(IOSAlertDialogAnimator, [{
       key: 'show',
       value: function show(dialog, callback) {
         callback = callback ? callback : function () {};

         animit.runAll(animit(dialog._mask).queue({
           opacity: 0
         }).wait(this.delay).queue({
           opacity: 1.0
         }, {
           duration: this.duration,
           timing: this.timing
         }), animit(dialog._dialog).saveStyle().queue({
           css: {
             transform: 'translate3d(-50%, -50%, 0) scale3d(1.3, 1.3, 1.0)',
             opacity: 0.0
           },
           duration: 0
         }).wait(this.delay).queue({
           css: {
             transform: 'translate3d(-50%, -50%, 0) scale3d(1.0, 1.0, 1.0)',
             opacity: 1.0
           },
           duration: this.duration,
           timing: this.timing
         }).restoreStyle().queue(function (done) {
           callback();
           done();
         }));
       }

       /**
        * @param {Object} dialog
        * @param {Function} callback
        */

     }, {
       key: 'hide',
       value: function hide(dialog, callback) {
         callback = callback ? callback : function () {};

         animit.runAll(animit(dialog._mask).queue({
           opacity: 1.0
         }).wait(this.delay).queue({
           opacity: 0
         }, {
           duration: this.duration,
           timing: this.timing
         }), animit(dialog._dialog).saveStyle().queue({
           css: {
             opacity: 1.0
           },
           duration: 0
         }).wait(this.delay).queue({
           css: {
             opacity: 0.0
           },
           duration: this.duration,
           timing: this.timing
         }).restoreStyle().queue(function (done) {
           callback();
           done();
         }));
       }
     }]);
     return IOSAlertDialogAnimator;
   })(AlertDialogAnimator);

   var scheme$20 = {
     '.alert-dialog': 'alert-dialog--*',
     '.alert-dialog-container': 'alert-dialog-container--*',
     '.alert-dialog-title': 'alert-dialog-title--*',
     '.alert-dialog-content': 'alert-dialog-content--*',
     '.alert-dialog-footer': 'alert-dialog-footer--*',
     '.alert-dialog-button': 'alert-dialog-button--*',
     '.alert-dialog-footer--one': 'alert-dialog-footer--one--*',
     '.alert-dialog-button--one': 'alert-dialog-button--one--*',
     '.alert-dialog-button--primal': 'alert-dialog-button--primal--*',
     '.alert-dialog-mask': 'alert-dialog-mask--*'
   };

   var templateSource$1 = util.createElement('\n  <div>\n    <div class="alert-dialog-mask"></div>\n    <div class="alert-dialog">\n      <div class="alert-dialog-container"></div>\n    </div>\n  </div>\n');

   var _animatorDict = {
     'none': AlertDialogAnimator,
     'default': function _default() {
       return platform.isAndroid() ? AndroidAlertDialogAnimator : IOSAlertDialogAnimator;
     },
     'fade': function fade() {
       return platform.isAndroid() ? AndroidAlertDialogAnimator : IOSAlertDialogAnimator;
     }
   };

   /**
    * @element ons-alert-dialog
    * @category dialog
    * @description
    *   [en]Alert dialog that is displayed on top of the current screen.[/en]
    *   [ja]現在のスクリーンにアラートダイアログを表示します。[/ja]
    * @codepen Qwwxyp
    * @guide UsingAlert
    *   [en]Learn how to use the alert dialog.[/en]
    *   [ja]アラートダイアログの使い方の解説。[/ja]
    * @seealso ons-dialog
    *   [en]ons-dialog component[/en]
    *   [ja]ons-dialogコンポーネント[/ja]
    * @seealso ons-popover
    *   [en]ons-popover component[/en]
    *   [ja]ons-dialogコンポーネント[/ja]
    * @seealso ons.notification
    *   [en]Using ons.notification utility functions.[/en]
    *   [ja]アラートダイアログを表示するには、ons.notificationオブジェクトのメソッドを使うこともできます。[/ja]
    * @example
    * <script>
    *   ons.ready(function() {
    *     ons.createAlertDialog('alert.html').then(function(alertDialog) {
    *       alertDialog.show();
    *     });
    *   });
    * </script>
    *
    * <script type="text/ons-template" id="alert.html">
    *   <ons-alert-dialog animation="default" cancelable>
    *     <div class="alert-dialog-title">Warning!</div>
    *     <div class="alert-dialog-content">
    *       An error has occurred!
    *     </div>
    *     <div class="alert-dialog-footer">
    *       <button class="alert-dialog-button">OK</button>
    *     </div>
    *   </ons-alert-dialog>
    * </script>
    */

   var AlertDialogElement = (function (_BaseElement) {
     babelHelpers.inherits(AlertDialogElement, _BaseElement);

     function AlertDialogElement() {
       babelHelpers.classCallCheck(this, AlertDialogElement);
       return babelHelpers.possibleConstructorReturn(this, Object.getPrototypeOf(AlertDialogElement).apply(this, arguments));
     }

     babelHelpers.createClass(AlertDialogElement, [{
       key: 'createdCallback',
       value: function createdCallback() {
         if (!this.hasAttribute('_compiled')) {
           this._compile();
         }

         this._visible = false;
         this._doorLock = new DoorLock();
         this._boundCancel = this._cancel.bind(this);

         this._animatorFactory = new AnimatorFactory({
           animators: _animatorDict,
           baseClass: AlertDialogAnimator,
           baseClassName: 'AlertDialogAnimator',
           defaultAnimation: this.getAttribute('animation')
         });
       }
     }, {
       key: '_compile',
       value: function _compile() {
         ons._autoStyle.prepare(this);

         var style = this.getAttribute('style');

         this.style.display = 'none';

         var template = templateSource$1.cloneNode(true);
         var alertDialog = template.children[1];

         if (style) {
           alertDialog.setAttribute('style', style);
         }

         while (this.firstChild) {
           alertDialog.children[0].appendChild(this.firstChild);
         }

         while (template.firstChild) {
           this.appendChild(template.firstChild);
         }

         this._dialog.style.zIndex = 20001;
         this._mask.style.zIndex = 20000;

         if (this.getAttribute('mask-color')) {
           this._mask.style.backgroundColor = this.getAttribute('mask-color');
         }

         ModifierUtil.initModifier(this, scheme$20);

         this.setAttribute('_compiled', '');
       }

       /**
        * @method setDisabled
        * @signature setDisabled(disabled)
        * @description
        *   [en]Disable or enable the alert dialog.[/en]
        *   [ja]このアラートダイアログをdisabled状態にするかどうかを設定します。[/ja]
        * @param {Boolean} disabled
        *   [en]If true the dialog will be disabled.[/en]
        *   [ja]disabled状態にするかどうかを真偽値で指定します。[/ja]
        */

     }, {
       key: 'setDisabled',
       value: function setDisabled(disabled) {
         if (typeof disabled !== 'boolean') {
           throw new Error('Argument must be a boolean.');
         }

         if (disabled) {
           this.setAttribute('disabled', '');
         } else {
           this.removeAttribute('disabled');
         }
       }

       /**
        * @method isDisabled
        * @signature isDisabled()
        * @description
        *   [en]Returns whether the dialog is disabled or enabled.[/en]
        *   [ja]このアラートダイアログがdisabled状態かどうかを返します。[/ja]
        * @return {Boolean}
        *   [en]true if the dialog is disabled.[/en]
        *   [ja]disabled状態であればtrueを返します。[/ja]
        */

     }, {
       key: 'isDisabled',
       value: function isDisabled() {
         return this.hasAttribute('disabled');
       }

       /**
        * @method setCancelable
        * @signature setCancelable(cancelable)
        * @description
        *   [en]Define whether the dialog can be canceled by the user or not.[/en]
        *   [ja]アラートダイアログを表示した際に、ユーザがそのダイアログをキャンセルできるかどうかを指定します。[/ja]
        * @param {Boolean} cancelable
        *   [en]If true the dialog will be cancelable.[/en]
        *   [ja]キャンセルできるかどうかを真偽値で指定します。[/ja]
        */

     }, {
       key: 'setCancelable',
       value: function setCancelable(cancelable) {
         if (typeof cancelable !== 'boolean') {
           throw new Error('Argument must be a boolean.');
         }

         if (cancelable) {
           this.setAttribute('cancelable', '');
         } else {
           this.removeAttribute('cancelable');
         }
       }

       /**
        * @method show
        * @signature show([options])
        * @param {Object} [options]
        *   [en]Parameter object.[/en]
        *   [ja]オプションを指定するオブジェクトです。[/ja]
        * @param {String} [options.animation]
        *   [en]Animation name. Available animations are "fade", "slide" and "none".[/en]
        *   [ja]アニメーション名を指定します。指定できるのは、"fade", "slide", "none"のいずれかです。[/ja]
        * @param {String} [options.animationOptions]
        *   [en]Specify the animation's duration, delay and timing. E.g.  <code>{duration: 0.2, delay: 0.4, timing: 'ease-in'}</code>[/en]
        *   [ja]アニメーション時のduration, delay, timingを指定します。e.g. <code>{duration: 0.2, delay: 0.4, timing: 'ease-in'}</code> [/ja]
        * @param {Function} [options.callback]
        *   [en]Function to execute after the dialog has been revealed.[/en]
        *   [ja]ダイアログが表示され終わった時に呼び出されるコールバックを指定します。[/ja]
        * @description
        *   [en]Show the alert dialog.[/en]
        *   [ja]ダイアログを表示します。[/ja]
        * @return {Promise}
        *   [en]Resolves to the displayed element[/en]
        *   [ja][/ja]
        */

     }, {
       key: 'show',
       value: function show() {
         var _this2 = this;

         var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

         var _cancel2 = false;
         var callback = options.callback || function () {};

         options.animationOptions = util.extend(options.animationOptions || {}, AnimatorFactory.parseAnimationOptionsString(this.getAttribute('animation-options')));

         util.triggerElementEvent(this, 'preshow', {
           alertDialog: this,
           cancel: function cancel() {
             _cancel2 = true;
           }
         });

         if (!_cancel2) {
           var _ret = (function () {
             var tryShow = function tryShow() {
               var unlock = _this2._doorLock.lock();
               var animator = _this2._animatorFactory.newAnimator(options);

               _this2.style.display = 'block';
               _this2._mask.style.opacity = '1';

               return new Promise(function (resolve) {
                 animator.show(_this2, function () {
                   _this2._visible = true;
                   unlock();

                   util.triggerElementEvent(_this2, 'postshow', { alertDialog: _this2 });

                   callback();
                   resolve(_this2);
                 });
               });
             };

             return {
               v: new Promise(function (resolve) {
                 _this2._doorLock.waitUnlock(function () {
                   return resolve(tryShow());
                 });
               })
             };
           })();

           if ((typeof _ret === 'undefined' ? 'undefined' : babelHelpers.typeof(_ret)) === "object") return _ret.v;
         } else {
           return Promise.reject('Canceled in preshow event.');
         }
       }

       /**
        * @method hide
        * @signature hide([options])
        * @param {Object} [options]
        *   [en]Parameter object.[/en]
        *   [ja]オプションを指定するオブジェクト。[/ja]
        * @param {String} [options.animation]
        *   [en]Animation name. Available animations are "fade", "slide" and "none".[/en]
        *   [ja]アニメーション名を指定します。"fade", "slide", "none"のいずれかを指定します。[/ja]
        * @param {String} [options.animationOptions]
        *   [en]Specify the animation's duration, delay and timing. E.g.  <code>{duration: 0.2, delay: 0.4, timing: 'ease-in'}</code>[/en]
        *   [ja]アニメーション時のduration, delay, timingを指定します。e.g. <code>{duration: 0.2, delay: 0.4, timing: 'ease-in'}</code> [/ja]
        * @param {Function} [options.callback]
        *   [en]Function to execute after the dialog has been hidden.[/en]
        *   [ja]このダイアログが閉じた時に呼び出されるコールバックを指定します。[/ja]
        * @description
        *   [en]Hide the alert dialog.[/en]
        *   [ja]ダイアログを閉じます。[/ja]
        * @return {Promise}
        *   [en]Resolves to the hidden element[/en]
        *   [ja][/ja]
        */

     }, {
       key: 'hide',
       value: function hide() {
         var _this3 = this;

         var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

         var _cancel3 = false;
         var callback = options.callback || function () {};

         options.animationOptions = util.extend(options.animationOptions || {}, AnimatorFactory.parseAnimationOptionsString(this.getAttribute('animation-options')));

         util.triggerElementEvent(this, 'prehide', {
           alertDialog: this,
           cancel: function cancel() {
             _cancel3 = true;
           }
         });

         if (!_cancel3) {
           var _ret2 = (function () {
             var tryHide = function tryHide() {
               var unlock = _this3._doorLock.lock();
               var animator = _this3._animatorFactory.newAnimator(options);

               return new Promise(function (resolve) {
                 animator.hide(_this3, function () {
                   _this3.style.display = 'none';
                   _this3._visible = false;
                   unlock();

                   util.triggerElementEvent(_this3, 'posthide', { alertDialog: _this3 });

                   callback();
                   resolve(_this3);
                 });
               });
             };

             return {
               v: new Promise(function (resolve) {
                 _this3._doorLock.waitUnlock(function () {
                   return resolve(tryHide());
                 });
               })
             };
           })();

           if ((typeof _ret2 === 'undefined' ? 'undefined' : babelHelpers.typeof(_ret2)) === "object") return _ret2.v;
         } else {
           return Promise.reject('Canceled in prehide event.');
         }
       }

       /**
        * @method isShown
        * @signature isShown()
        * @return {Boolean}
        * @description
        *   [en]Returns whether the dialog is visible or not.[/en]
        *   [ja]ダイアログが表示されているかどうかを返します。[/ja]
        * @return {Boolean}
        *   [en]true if the dialog is currently visible.[/en]
        *   [ja]ダイアログが表示されていればtrueを返します。[/ja]
        */

     }, {
       key: 'isShown',
       value: function isShown() {
         return this._visible;
       }

       /**
        * @method destroy
        * @signature destroy()
        * @description
        *   [en]Destroy the alert dialog and remove it from the DOM tree.[/en]
        *   [ja]ダイアログを破棄して、DOMツリーから取り除きます。[/ja]
        */

     }, {
       key: 'destroy',
       value: function destroy() {
         if (this.parentElement) {
           this.parentElement.removeChild(this);
         }
       }

       /**
        * @method isCancelable
        * @signature isCancelable()
        * @description
        *   [en]Returns whether the dialog is cancelable or not.[/en]
        *   [ja]このアラートダイアログがキャンセル可能かどうかを返します。[/ja]
        * @return {Boolean}
        *   [en]true if the dialog is cancelable.[/en]
        *   [ja]キャンセル可能であればtrueを返します。[/ja]
        */

     }, {
       key: 'isCancelable',
       value: function isCancelable() {
         return this.hasAttribute('cancelable');
       }
     }, {
       key: '_onDeviceBackButton',
       value: function _onDeviceBackButton(event) {
         if (this.isCancelable()) {
           this._cancel();
         } else {
           event.callParentHandler();
         }
       }
     }, {
       key: '_cancel',
       value: function _cancel() {
         var _this4 = this;

         if (this.isCancelable()) {
           this.hide({
             callback: function callback() {
               util.triggerElementEvent(_this4, 'cancel');
             }
           });
         }
       }
     }, {
       key: 'attachedCallback',
       value: function attachedCallback() {
         this._deviceBackButtonHandler = deviceBackButtonDispatcher.createHandler(this, this._onDeviceBackButton.bind(this));

         this._mask.addEventListener('click', this._boundCancel, false);
       }
     }, {
       key: 'detachedCallback',
       value: function detachedCallback() {
         this._deviceBackButtonHandler.destroy();
         this._deviceBackButtonHandler = null;

         this._mask.removeEventListener('click', this._boundCancel.bind(this), false);
       }
     }, {
       key: 'attributeChangedCallback',
       value: function attributeChangedCallback(name, last, current) {
         if (name === 'modifier') {
           return ModifierUtil.onModifierChanged(last, current, this, scheme$20);
         }
       }
     }, {
       key: '_mask',

       /**
        * @event preshow
        * @description
        *   [en]Fired just before the alert dialog is displayed.[/en]
        *   [ja]アラートダイアログが表示される直前に発火します。[/ja]
        * @param {Object} event [en]Event object.[/en]
        * @param {Object} event.alertDialog
        *   [en]Alert dialog object.[/en]
        *   [ja]アラートダイアログのオブジェクト。[/ja]
        * @param {Function} event.cancel
        *   [en]Execute to stop the dialog from showing.[/en]
        *   [ja]この関数を実行すると、アラートダイアログの表示を止めます。[/ja]
        */

       /**
        * @event postshow
        * @description
        *   [en]Fired just after the alert dialog is displayed.[/en]
        *   [ja]アラートダイアログが表示された直後に発火します。[/ja]
        * @param {Object} event [en]Event object.[/en]
        * @param {Object} event.alertDialog
        *   [en]Alert dialog object.[/en]
        *   [ja]アラートダイアログのオブジェクト。[/ja]
        */

       /**
        * @event prehide
        * @description
        *   [en]Fired just before the alert dialog is hidden.[/en]
        *   [ja]アラートダイアログが隠れる直前に発火します。[/ja]
        * @param {Object} event [en]Event object.[/en]
        * @param {Object} event.alertDialog
        *   [en]Alert dialog object.[/en]
        *   [ja]アラートダイアログのオブジェクト。[/ja]
        * @param {Function} event.cancel
        *   [en]Execute to stop the dialog from hiding.[/en]
        *   [ja]この関数を実行すると、アラートダイアログが閉じようとするのを止めます。[/ja]
        */

       /**
        * @event posthide
        * @description
        * [en]Fired just after the alert dialog is hidden.[/en]
        * [ja]アラートダイアログが隠れた後に発火します。[/ja]
        * @param {Object} event [en]Event object.[/en]
        * @param {Object} event.alertDialog
        *   [en]Alert dialog object.[/en]
        *   [ja]アラートダイアログのオブジェクト。[/ja]
        */

       /**
        * @attribute modifier
        * @type {String}
        * @description
        *  [en]The appearance of the dialog.[/en]
        *  [ja]ダイアログの見た目を指定します。[/ja]
        */

       /**
        * @attribute cancelable
        * @description
        *  [en]If this attribute is set the dialog can be closed by tapping the background or by pressing the back button.[/en]
        *  [ja]この属性があると、ダイアログが表示された時に、背景やバックボタンをタップした時にダイアログを閉じます。[/ja]
        */

       /**
        * @attribute disabled
        * @description
        *  [en]If this attribute is set the dialog is disabled.[/en]
        *  [ja]この属性がある時、アラートダイアログはdisabled状態になります。[/ja]
        */

       /**
        * @attribute animation
        * @type {String}
        * @default default
        * @description
        *  [en]The animation used when showing and hiding the dialog. Can be either "none" or "default".[/en]
        *  [ja]ダイアログを表示する際のアニメーション名を指定します。デフォルトでは"none"か"default"が指定できます。[/ja]
        */

       /**
        * @attribute animation-options
        * @type {Expression}
        * @description
        *  [en]Specify the animation's duration, timing and delay with an object literal. E.g. <code>{duration: 0.2, delay: 1, timing: 'ease-in'}</code>[/en]
        *  [ja]アニメーション時のduration, timing, delayをオブジェクトリテラルで指定します。e.g. <code>{duration: 0.2, delay: 1, timing: 'ease-in'}</code>[/ja]
        */

       /**
        * @attribute mask-color
        * @type {String}
        * @default rgba(0, 0, 0, 0.2)
        * @description
        *  [en]Color of the background mask. Default is "rgba(0, 0, 0, 0.2)".[/en]
        *  [ja]背景のマスクの色を指定します。"rgba(0, 0, 0, 0.2)"がデフォルト値です。[/ja]
        */

       /**
        * @return {Element}
        */
       get: function get() {
         return util.findChild(this, '.alert-dialog-mask');
       }

       /**
        * @return {Element}
        */

     }, {
       key: '_dialog',
       get: function get() {
         return util.findChild(this, '.alert-dialog');
       }

       /**
        * @return {Element}
        */

     }, {
       key: '_titleElement',
       get: function get() {
         return util.findChild(this._dialog.children[0], '.alert-dialog-title');
       }

       /**
        * @return {Element}
        */

     }, {
       key: '_contentElement',
       get: function get() {
         return util.findChild(this._dialog.children[0], '.alert-dialog-content');
       }
     }]);
     return AlertDialogElement;
   })(BaseElement);

   var OnsAlertDialogElement = window.OnsAlertDialogElement = document.registerElement('ons-alert-dialog', {
     prototype: AlertDialogElement.prototype
   });

   /**
    * @param {String} name
    * @param {DialogAnimator} Animator
    */
   OnsAlertDialogElement.registerAnimator = function (name, Animator) {
     if (!(Animator.prototype instanceof AlertDialogAnimator)) {
       throw new Error('"Animator" param must inherit OnsAlertDialogElement.AlertDialogAnimator');
     }
     _animatorDict[name] = Animator;
   };

   OnsAlertDialogElement.AlertDialogAnimator = AlertDialogAnimator;

   var scheme = {
     '': 'back-button--*',
     '.back-button__icon': 'back-button--*__icon',
     '.back-button__label': 'back-button--*__label'
   };

   /**
    * @element ons-back-button
    * @category page
    * @description
    *   [en]Back button component for ons-toolbar. Can be used with ons-navigator to provide back button support.[/en]
    *   [ja]ons-toolbarに配置できる「戻るボタン」用コンポーネントです。ons-navigatorと共に使用し、ページを1つ前に戻る動作を行います。[/ja]
    * @codepen aHmGL
    * @seealso ons-toolbar
    *   [en]ons-toolbar component[/en]
    *   [ja]ons-toolbarコンポーネント[/ja]
    * @seealso ons-navigator
    *   [en]ons-navigator component[/en]
    *   [ja]ons-navigatorコンポーネント[/en]
    * @guide Addingatoolbar
    *   [en]Adding a toolbar[/en]
    *   [ja]ツールバーの追加[/ja]
    * @guide Returningfromapage
    *   [en]Returning from a page[/en]
    *   [ja]一つ前のページに戻る[/ja]
    * @example
    * <ons-back-button>
    *   Back
    * </ons-back-button>
    */

   var BackButtonElement = (function (_BaseElement) {
     babelHelpers.inherits(BackButtonElement, _BaseElement);

     function BackButtonElement() {
       babelHelpers.classCallCheck(this, BackButtonElement);
       return babelHelpers.possibleConstructorReturn(this, Object.getPrototypeOf(BackButtonElement).apply(this, arguments));
     }

     babelHelpers.createClass(BackButtonElement, [{
       key: 'createdCallback',
       value: function createdCallback() {
         if (!this.hasAttribute('_compiled')) {
           this._compile();
         }

         this._options = {};
         this._boundOnClick = this._onClick.bind(this);
       }
     }, {
       key: '_compile',
       value: function _compile() {
         ons._autoStyle.prepare(this);

         this.classList.add('back-button');

         var label = util.createElement('\n      <span class="back-button__label">' + this.innerHTML + '</span>\n    ');

         this.innerHTML = '';

         var icon = util.createElement('\n      <span class="back-button__icon"></span>\n    ');

         this.appendChild(icon);
         this.appendChild(label);

         ModifierUtil.initModifier(this, scheme);

         this.setAttribute('_compiled', '');
       }

       /**
        * @return {object}
        */

     }, {
       key: '_onClick',
       value: function _onClick() {
         var navigator = util.findParent(this, 'ons-navigator');
         if (navigator) {
           if (this.hasAttribute('animation')) {
             this.options.animation = this.getAttribute('animation');
           }

           if (this.hasAttribute('animation-options')) {
             this.options.animationOptions = util.animationOptionsParse(this.getAttribute('animation-options'));
           }

           if (this.hasAttribute('on-transition-end')) {
             this.options.onTransitionEnd = window.eval('(' + this.getAttribute('on-transition-end') + ')');
           }

           if (this.hasAttribute('refresh')) {
             this.options.refresh = this.getAttribute('refresh') === 'true';
           }

           navigator.popPage(this.options);
         }
       }
     }, {
       key: 'attachedCallback',
       value: function attachedCallback() {
         this.addEventListener('click', this._boundOnClick, false);
       }
     }, {
       key: 'attributeChangedCallback',
       value: function attributeChangedCallback(name, last, current) {
         if (name === 'modifier') {
           return ModifierUtil.onModifierChanged(last, current, this, scheme);
         }
       }
     }, {
       key: 'detachedCallback',
       value: function detachedCallback() {
         this.removeEventListener('click', this._boundOnClick, false);
       }
     }, {
       key: 'show',
       value: function show() {
         this.style.display = 'inline-block';
       }
     }, {
       key: 'hide',
       value: function hide() {
         this.style.display = 'none';
       }
     }, {
       key: 'options',
       get: function get() {
         return this._options;
       }

       /**
        * @param {object}
        */
       ,
       set: function set(object) {
         this._options = object;
       }
     }]);
     return BackButtonElement;
   })(BaseElement);

   window.OnsBackButtonElement = document.registerElement('ons-back-button', {
     prototype: BackButtonElement.prototype
   });

   var scheme$1 = { '': 'bottom-bar--*' };

   /**
    * @element ons-bottom-toolbar
    * @category page
    * @description
    *   [en]Toolbar component that is positioned at the bottom of the page.[/en]
    *   [ja]ページ下部に配置されるツールバー用コンポーネントです。[/ja]
    * @modifier transparent
    *   [en]Make the toolbar transparent.[/en]
    *   [ja]ツールバーの背景を透明にして表示します。[/ja]
    * @seealso ons-toolbar [en]ons-toolbar component[/en][ja]ons-toolbarコンポーネント[/ja]
    * @guide Addingatoolbar
    *   [en]Adding a toolbar[/en]
    *   [ja]ツールバーの追加[/ja]
    * @example
    * <ons-bottom-toolbar>
    *   <div style="text-align: center; line-height: 44px">Text</div>
    * </ons-bottom-toolbar>
    */

   var BottomToolbarElement = (function (_BaseElement) {
     babelHelpers.inherits(BottomToolbarElement, _BaseElement);

     function BottomToolbarElement() {
       babelHelpers.classCallCheck(this, BottomToolbarElement);
       return babelHelpers.possibleConstructorReturn(this, Object.getPrototypeOf(BottomToolbarElement).apply(this, arguments));
     }

     babelHelpers.createClass(BottomToolbarElement, [{
       key: 'createdCallback',

       /**
        * @attribute modifier
        * @type {String}
        * @description
        *   [en]The appearance of the toolbar.[/en]
        *   [ja]ツールバーの見た目の表現を指定します。[/ja]
        */

       /**
        * @attribute inline
        * @initonly
        * @description
        *   [en]Display the toolbar as an inline element.[/en]
        *   [ja]この属性があると、ツールバーを画面下部ではなくスクロール領域内にそのまま表示します。[/ja]
        */

       value: function createdCallback() {
         this.classList.add('bottom-bar');
         this.style.zIndex = '0';
         this._update();

         ModifierUtil.initModifier(this, scheme$1);
       }
     }, {
       key: 'attributeChangedCallback',
       value: function attributeChangedCallback(name, last, current) {
         if (name === 'inline') {
           this._update();
         } else if (name === 'modifier') {
           return ModifierUtil.onModifierChanged(last, current, this, scheme$1);
         }
       }
     }, {
       key: '_update',
       value: function _update() {
         var inline = typeof this.getAttribute('inline') === 'string';

         this.style.position = inline ? 'static' : 'absolute';
       }
     }]);
     return BottomToolbarElement;
   })(BaseElement);

   window.OnsBottomToolbarElement = document.registerElement('ons-bottom-toolbar', {
     prototype: BottomToolbarElement.prototype
   });

   var scheme$3 = { '': 'button--*' };

   /**
    * @element ons-button
    * @category form
    * @modifier outline
    *   [en]Button with outline and transparent background[/en]
    *   [ja]アウトラインを持ったボタンを表示します。[/ja]
    * @modifier light
    *   [en]Button that doesn't stand out.[/en]
    *   [ja]目立たないボタンを表示します。[/ja]
    * @modifier quiet
    *   [en]Button with no outline and or background..[/en]
    *   [ja]枠線や背景が無い文字だけのボタンを表示します。[/ja]
    * @modifier cta
    *   [en]Button that really stands out.[/en]
    *   [ja]目立つボタンを表示します。[/ja]
    * @modifier large
    *   [en]Large button that covers the width of the screen.[/en]
    *   [ja]横いっぱいに広がる大きなボタンを表示します。[/ja]
    * @modifier large--quiet
    *   [en]Large quiet button.[/en]
    *   [ja]横いっぱいに広がるquietボタンを表示します。[/ja]
    * @modifier large--cta
    *   [en]Large call to action button.[/en]
    *   [ja]横いっぱいに広がるctaボタンを表示します。[/ja]
    * @description
    *   [en]Button component. If you want to place a button in a toolbar, use ons-toolbar-button or ons-back-button instead.[/en]
    *   [ja]ボタン用コンポーネント。ツールバーにボタンを設置する場合は、ons-toolbar-buttonもしくはons-back-buttonコンポーネントを使用します。[/ja]
    * @codepen hLayx
    * @guide Button [en]Guide for ons-button[/en][ja]ons-buttonの使い方[/ja]
    * @guide OverridingCSSstyles [en]More details about modifier attribute[/en][ja]modifier属性の使い方[/ja]
    * @example
    * <ons-button modifier="large--cta">
    *   Tap Me
    * </ons-button>
    */

   var ButtonElement = (function (_BaseElement) {
     babelHelpers.inherits(ButtonElement, _BaseElement);

     function ButtonElement() {
       babelHelpers.classCallCheck(this, ButtonElement);
       return babelHelpers.possibleConstructorReturn(this, Object.getPrototypeOf(ButtonElement).apply(this, arguments));
     }

     babelHelpers.createClass(ButtonElement, [{
       key: 'createdCallback',

       /**
        * @attribute modifier
        * @type {String}
        * @description
        *  [en]The appearance of the button.[/en]
        *  [ja]ボタンの表現を指定します。[/ja]
        */

       /**
        * @attribute disabled
        * @description
        *   [en]Specify if button should be disabled.[/en]
        *   [ja]ボタンを無効化する場合は指定します。[/ja]
        */

       value: function createdCallback() {
         if (!this.hasAttribute('_compiled')) {
           this._compile();
         }
       }
     }, {
       key: 'attributeChangedCallback',
       value: function attributeChangedCallback(name, last, current) {
         if (name === 'modifier') {
           return ModifierUtil.onModifierChanged(last, current, this, scheme$3);
         }
       }
     }, {
       key: '_compile',
       value: function _compile() {
         ons._autoStyle.prepare(this);

         this.classList.add('button');

         if (this.hasAttribute('ripple') && !util.findChild(this, 'ons-ripple')) {
           this.insertBefore(document.createElement('ons-ripple'), this.firstChild);
         }

         ModifierUtil.initModifier(this, scheme$3);

         this.setAttribute('_compiled', '');
       }
     }]);
     return ButtonElement;
   })(BaseElement);

   window.OnsButtonElement = document.registerElement('ons-button', {
     prototype: ButtonElement.prototype
   });

   var scheme$2 = { '': 'carousel-item--*' };

   /**
    * @element ons-carousel-item
    * @category carousel
    * @description
    *   [en]Carousel item component.[/en]
    *   [ja]カルーセルの要素を表現するコンポーネント。[/ja]
    * @codepen xbbzOQ
    * @seealso ons-carousel
    *   [en]ons-carousel components[/en]
    *   [ja]ons-carouselコンポーネント[/ja]
    * @example
    * <ons-carousel style="width: 100%; height: 200px">
    *   <ons-carousel-item>
    *    ...
    *   </ons-carousel-item>
    *   <ons-carousel-item>
    *    ...
    *   </ons-carousel-item>
    * </ons-carousel>
    */

   var CarouselItemElement = (function (_BaseElement) {
     babelHelpers.inherits(CarouselItemElement, _BaseElement);

     function CarouselItemElement() {
       babelHelpers.classCallCheck(this, CarouselItemElement);
       return babelHelpers.possibleConstructorReturn(this, Object.getPrototypeOf(CarouselItemElement).apply(this, arguments));
     }

     babelHelpers.createClass(CarouselItemElement, [{
       key: 'createdCallback',
       value: function createdCallback() {
         this.style.width = '100%';
         ModifierUtil.initModifier(this, scheme$2);
       }
     }, {
       key: 'attributeChangedCallback',
       value: function attributeChangedCallback(name, last, current) {
         if (name === 'modifier') {
           return ModifierUtil.onModifierChanged(last, current, this, scheme$2);
         }
       }
     }]);
     return CarouselItemElement;
   })(BaseElement);

   window.OnsCarouselItemElement = document.registerElement('ons-carousel-item', {
     prototype: CarouselItemElement.prototype
   });

   var scheme$4 = { '': 'carousel--*' };

   var VerticalModeTrait = {

     _getScrollDelta: function _getScrollDelta(event) {
       return event.gesture.deltaY;
     },

     _getScrollVelocity: function _getScrollVelocity(event) {
       return event.gesture.velocityY;
     },

     _getElementSize: function _getElementSize() {
       if (!this._currentElementSize) {
         this._currentElementSize = this.getBoundingClientRect().height;
       }

       return this._currentElementSize;
     },

     _generateScrollTransform: function _generateScrollTransform(scroll) {
       return 'translate3d(0px, ' + -scroll + 'px, 0px)';
     },

     _layoutCarouselItems: function _layoutCarouselItems() {
       var children = this._getCarouselItemElements();

       var sizeAttr = this._getCarouselItemSizeAttr();
       var sizeInfo = this._decomposeSizeString(sizeAttr);

       var computedStyle = window.getComputedStyle(this);
       var totalWidth = this.getBoundingClientRect().width || 0;
       var finalWidth = totalWidth - parseInt(computedStyle.paddingLeft, 10) - parseInt(computedStyle.paddingRight, 10);

       for (var i = 0; i < children.length; i++) {
         children[i].style.position = 'absolute';
         children[i].style.height = sizeAttr;
         children[i].style.width = finalWidth + 'px';
         children[i].style.visibility = 'visible';
         children[i].style.top = i * sizeInfo.number + sizeInfo.unit;
       }
     }
   };

   var HorizontalModeTrait = {

     _getScrollDelta: function _getScrollDelta(event) {
       return event.gesture.deltaX;
     },

     _getScrollVelocity: function _getScrollVelocity(event) {
       return event.gesture.velocityX;
     },

     _getElementSize: function _getElementSize() {
       if (!this._currentElementSize) {
         this._currentElementSize = this.getBoundingClientRect().width;
       }

       return this._currentElementSize;
     },

     _generateScrollTransform: function _generateScrollTransform(scroll) {
       return 'translate3d(' + -scroll + 'px, 0px, 0px)';
     },

     _layoutCarouselItems: function _layoutCarouselItems() {
       var children = this._getCarouselItemElements();

       var sizeAttr = this._getCarouselItemSizeAttr();
       var sizeInfo = this._decomposeSizeString(sizeAttr);

       var computedStyle = window.getComputedStyle(this);
       var totalHeight = this.getBoundingClientRect().height || 0;
       var finalHeight = totalHeight - parseInt(computedStyle.paddingTop, 10) - parseInt(computedStyle.paddingBottom, 10);

       for (var i = 0; i < children.length; i++) {
         children[i].style.position = 'absolute';
         children[i].style.height = finalHeight + 'px';
         children[i].style.width = sizeAttr;
         children[i].style.visibility = 'visible';
         children[i].style.left = i * sizeInfo.number + sizeInfo.unit;
       }
     }
   };

   /**
    * @element ons-carousel
    * @category carousel
    * @description
    *   [en]Carousel component.[/en]
    *   [ja]カルーセルを表示できるコンポーネント。[/ja]
    * @codepen xbbzOQ
    * @seealso ons-carousel-item
    *   [en]ons-carousel-item component[/en]
    *   [ja]ons-carousel-itemコンポーネント[/ja]
    * @guide UsingCarousel
    *   [en]Learn how to use the carousel component.[/en]
    *   [ja]carouselコンポーネントの使い方[/ja]
    * @example
    * <ons-carousel style="width: 100%; height: 200px">
    *   <ons-carousel-item>
    *    ...
    *   </ons-carousel-item>
    *   <ons-carousel-item>
    *    ...
    *   </ons-carousel-item>
    * </ons-carousel>
    */

   var CarouselElement = (function (_BaseElement) {
     babelHelpers.inherits(CarouselElement, _BaseElement);

     function CarouselElement() {
       babelHelpers.classCallCheck(this, CarouselElement);
       return babelHelpers.possibleConstructorReturn(this, Object.getPrototypeOf(CarouselElement).apply(this, arguments));
     }

     babelHelpers.createClass(CarouselElement, [{
       key: 'createdCallback',

       /**
        * @event postchange
        * @description
        *   [en]Fired just after the current carousel item has changed.[/en]
        *   [ja]現在表示しているカルーセルの要素が変わった時に発火します。[/ja]
        * @param {Object} event
        *   [en]Event object.[/en]
        *   [ja]イベントオブジェクトです。[/ja]
        * @param {Object} event.carousel
        *   [en]Carousel object.[/en]
        *   [ja]イベントが発火したCarouselオブジェクトです。[/ja]
        * @param {Number} event.activeIndex
        *   [en]Current active index.[/en]
        *   [ja]現在アクティブになっている要素のインデックス。[/ja]
        * @param {Number} event.lastActiveIndex
        *   [en]Previous active index.[/en]
        *   [ja]以前アクティブだった要素のインデックス。[/ja]
        */

       /**
        * @event refresh
        * @description
        *   [en]Fired when the carousel has been refreshed.[/en]
        *   [ja]カルーセルが更新された時に発火します。[/ja]
        * @param {Object} event
        *   [en]Event object.[/en]
        *   [ja]イベントオブジェクトです。[/ja]
        * @param {Object} event.carousel
        *   [en]Carousel object.[/en]
        *   [ja]イベントが発火したCarouselオブジェクトです。[/ja]
        */

       /**
        * @event overscroll
        * @description
        *   [en]Fired when the carousel has been overscrolled.[/en]
        *   [ja]カルーセルがオーバースクロールした時に発火します。[/ja]
        * @param {Object} event
        *   [en]Event object.[/en]
        *   [ja]イベントオブジェクトです。[/ja]
        * @param {Object} event.carousel
        *   [en]Fired when the carousel has been refreshed.[/en]
        *   [ja]カルーセルが更新された時に発火します。[/ja]
        * @param {Number} event.activeIndex
        *   [en]Current active index.[/en]
        *   [ja]現在アクティブになっている要素のインデックス。[/ja]
        * @param {String} event.direction
        *   [en]Can be one of either "up", "down", "left" or "right".[/en]
        *   [ja]オーバースクロールされた方向が得られます。"up", "down", "left", "right"のいずれかの方向が渡されます。[/ja]
        * @param {Function} event.waitToReturn
        *   [en]Takes a <code>Promise</code> object as an argument. The carousel will not scroll back until the promise has been resolved or rejected.[/en]
        *   [ja]この関数はPromiseオブジェクトを引数として受け取ります。渡したPromiseオブジェクトがresolveされるかrejectされるまで、カルーセルはスクロールバックしません。[/ja]
        */

       /**
        * @attribute direction
        * @type {String}
        * @description
        *   [en]The direction of the carousel. Can be either "horizontal" or "vertical". Default is "horizontal".[/en]
        *   [ja]カルーセルの方向を指定します。"horizontal"か"vertical"を指定できます。"horizontal"がデフォルト値です。[/ja]
        */

       /**
        * @attribute fullscreen
        * @description
        *   [en]If this attribute is set the carousel will cover the whole screen.[/en]
        *   [ja]この属性があると、absoluteポジションを使ってカルーセルが自動的に画面いっぱいに広がります。[/ja]
        */

       /**
        * @attribute overscrollable
        * @description
        *   [en]If this attribute is set the carousel will be scrollable over the edge. It will bounce back when released.[/en]
        *   [ja]この属性がある時、タッチやドラッグで端までスクロールした時に、バウンドするような効果が当たります。[/ja]
        */

       /**
        * @attribute item-width
        * @type {String}
        * @description
        *    [en]ons-carousel-item's width. Only works when the direction is set to "horizontal".[/en]
        *    [ja]ons-carousel-itemの幅を指定します。この属性は、direction属性に"horizontal"を指定した時のみ有効になります。[/ja]
        */

       /**
        * @attribute item-height
        * @type {String}
        * @description
        *   [en]ons-carousel-item's height. Only works when the direction is set to "vertical".[/en]
        *   [ja]ons-carousel-itemの高さを指定します。この属性は、direction属性に"vertical"を指定した時のみ有効になります。[/ja]
        */

       /**
        * @attribute auto-scroll
        * @description
        *   [en]If this attribute is set the carousel will be automatically scrolled to the closest item border when released.[/en]
        *   [ja]この属性がある時、一番近いcarousel-itemの境界まで自動的にスクロールするようになります。[/ja]
        */

       /**
        * @attribute auto-scroll-ratio
        * @type {Number}
        * @description
        *    [en]A number between 0.0 and 1.0 that specifies how much the user must drag the carousel in order for it to auto scroll to the next item.[/en]
        *    [ja]0.0から1.0までの値を指定します。カルーセルの要素をどれぐらいの割合までドラッグすると次の要素に自動的にスクロールするかを指定します。[/ja]
        */

       /**
        * @attribute swipeable
        * @description
        *   [en]If this attribute is set the carousel can be scrolled by drag or swipe.[/en]
        *   [ja]この属性がある時、カルーセルをスワイプやドラッグで移動できるようになります。[/ja]
        */

       /**
        * @attribute disabled
        * @description
        *   [en]If this attribute is set the carousel is disabled.[/en]
        *   [ja]この属性がある時、dragやtouchやswipeを受け付けなくなります。[/ja]
        */

       /**
        * @attribute initial-index
        * @initonly
        * @type {Number}
        * @description
        *   [en]Specify the index of the ons-carousel-item to show initially. Default is 0.[/en]
        *   [ja]最初に表示するons-carousel-itemを0始まりのインデックスで指定します。デフォルト値は 0 です。[/ja]
        */

       /**
        * @attribute auto-refresh
        * @description
        *   [en]When this attribute is set the carousel will automatically refresh when the number of child nodes change.[/en]
        *   [ja]この属性がある時、子要素の数が変わるとカルーセルは自動的に更新されるようになります。[/ja]
        */

       value: function createdCallback() {
         ModifierUtil.initModifier(this, scheme$4);
         this._doorLock = new DoorLock();
         this._scroll = 0;
         this._lastActiveIndex = 0;

         this._boundOnDrag = this._onDrag.bind(this);
         this._boundOnDragEnd = this._onDragEnd.bind(this);
         this._boundOnResize = this._onResize.bind(this);

         this._mixin(this._isVertical() ? VerticalModeTrait : HorizontalModeTrait);

         this._layoutCarouselItems();
         this._setupInitialIndex();

         this._saveLastState();
       }
     }, {
       key: '_onResize',
       value: function _onResize() {
         this.refresh();
       }
     }, {
       key: '_onDirectionChange',
       value: function _onDirectionChange() {
         if (this._isVertical()) {
           this.style.overflowX = 'auto';
           this.style.overflowY = '';
         } else {
           this.style.overflowX = '';
           this.style.overflowY = 'auto';
         }

         this.refresh();
       }
     }, {
       key: '_saveLastState',
       value: function _saveLastState() {
         this._lastState = {
           elementSize: this._getCarouselItemSize(),
           carouselElementCount: this.getCarouselItemCount(),
           width: this._getCarouselItemSize() * this.getCarouselItemCount()
         };
       }

       /**
        * @return {Number}
        */

     }, {
       key: '_getCarouselItemSize',
       value: function _getCarouselItemSize() {
         var sizeAttr = this._getCarouselItemSizeAttr();
         var sizeInfo = this._decomposeSizeString(sizeAttr);
         var elementSize = this._getElementSize();

         if (sizeInfo.unit === '%') {
           return Math.round(sizeInfo.number / 100 * elementSize);
         } else if (sizeInfo.unit === 'px') {
           return sizeInfo.number;
         } else {
           throw new Error('Invalid state');
         }
       }

       /**
        * @return {Number}
        */

     }, {
       key: '_getInitialIndex',
       value: function _getInitialIndex() {
         var index = parseInt(this.getAttribute('initial-index'), 10);

         if (typeof index === 'number' && !isNaN(index)) {
           return Math.max(Math.min(index, this.getCarouselItemCount() - 1), 0);
         } else {
           return 0;
         }
       }

       /**
        * @return {String}
        */

     }, {
       key: '_getCarouselItemSizeAttr',
       value: function _getCarouselItemSizeAttr() {
         var attrName = 'item-' + (this._isVertical() ? 'height' : 'width');
         var itemSizeAttr = ('' + this.getAttribute(attrName)).trim();

         return itemSizeAttr.match(/^\d+(px|%)$/) ? itemSizeAttr : '100%';
       }

       /**
        * @return {Object}
        */

     }, {
       key: '_decomposeSizeString',
       value: function _decomposeSizeString(size) {
         var matches = size.match(/^(\d+)(px|%)/);

         return {
           number: parseInt(matches[1], 10),
           unit: matches[2]
         };
       }
     }, {
       key: '_setupInitialIndex',
       value: function _setupInitialIndex() {
         this._scroll = this._getCarouselItemSize() * this._getInitialIndex();
         this._lastActiveIndex = this._getInitialIndex();
         this._scrollTo(this._scroll);
       }

       /**
        * @method setSwipeable
        * @signature setSwipeable(swipeable)
        * @param {Boolean} swipeable
        *   [en]If value is true the carousel will be swipeable.[/en]
        *   [ja]swipeableにする場合にはtrueを指定します。[/ja]
        * @description
        *   [en]Set whether the carousel is swipeable or not.[/en]
        *   [ja]swipeできるかどうかを指定します。[/ja]
        */

     }, {
       key: 'setSwipeable',
       value: function setSwipeable(swipeable) {
         if (swipeable) {
           this.setAttribute('swipeable', '');
         } else {
           this.removeAttribute('swipeable');
         }
       }

       /**
        * @method isSwipeable
        * @signature isSwipeable()
        * @return {Boolean}
        *   [en]true if the carousel is swipeable.[/en]
        *   [ja]swipeableであればtrueを返します。[/ja]
        * @description
        *   [en]Returns whether the carousel is swipeable or not.[/en]
        *   [ja]swipeable属性があるかどうかを返します。[/ja]
        */

     }, {
       key: 'isSwipeable',
       value: function isSwipeable() {
         return this.hasAttribute('swipeable');
       }

       /**
        * @method setAutoScrollRatio
        * @signature setAutoScrollRatio(ratio)
        * @param {Number} ratio
        *   [en]The desired ratio.[/en]
        *   [ja]オートスクロールするのに必要な0.0から1.0までのratio値を指定します。[/ja]
        * @description
        *   [en]Set the auto scroll ratio. Must be a value between 0.0 and 1.0.[/en]
        *   [ja]オートスクロールするのに必要なratio値を指定します。0.0から1.0を必ず指定しなければならない。[/ja]
        */

     }, {
       key: 'setAutoScrollRatio',
       value: function setAutoScrollRatio(ratio) {
         if (ratio < 0.0 || ratio > 1.0) {
           throw new Error('Invalid ratio.');
         }

         this.setAttribute('auto-scroll-ratio', ratio);
       }

       /**
        * @method getAutoScrollRatio
        * @signature getAutoScrollRatio()
        * @return {Number}
        *   [en]The current auto scroll ratio.[/en]
        *   [ja]現在のオートスクロールのratio値。[/ja]
        * @description
        *   [en]Returns the current auto scroll ratio.[/en]
        *   [ja]現在のオートスクロールのratio値を返します。[/ja]
        */

     }, {
       key: 'getAutoScrollRatio',
       value: function getAutoScrollRatio() {
         var attr = this.getAttribute('auto-scroll-ratio');

         if (!attr) {
           return 0.5;
         }

         var scrollRatio = parseFloat(attr);
         if (scrollRatio < 0.0 || scrollRatio > 1.0) {
           throw new Error('Invalid ratio.');
         }

         return isNaN(scrollRatio) ? 0.5 : scrollRatio;
       }

       /**
        * @method setActiveCarouselItemIndex
        * @signature setActiveCarouselItemIndex(index, [options])
        * @param {Number} index
        *   [en]The index that the carousel should be set to.[/en]
        *   [ja]carousel要素のインデックスを指定します。[/ja]
        * @param {Object} [options]
        *   [en][/en]
        *   [ja][/ja]
        * @param {Function} [options.callback]
        *   [en][/en]
        *   [ja][/ja]
        * @param {String} [options.animation]
        *   [en][/en]
        *   [ja][/ja]
        * @description
        *   [en]Specify the index of the ons-carousel-item to show.[/en]
        *   [ja]表示するons-carousel-itemをindexで指定します。[/ja]
        * @param {Object} [options.animationOptions]
        * @return {Promise} Resolves to the carousel element
        */

     }, {
       key: 'setActiveCarouselItemIndex',
       value: function setActiveCarouselItemIndex(index) {
         var _this2 = this;

         var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

         if (options && (typeof options === 'undefined' ? 'undefined' : babelHelpers.typeof(options)) != 'object') {
           throw new Error('options must be an object. You supplied ' + options);
         }

         options.animationOptions = util.extend({ duration: 0.3, timing: 'cubic-bezier(.1, .7, .1, 1)' }, options.animationOptions || {}, this.hasAttribute('animation-options') ? util.animationOptionsParse(this.getAttribute('animation-options')) : {});

         index = Math.max(0, Math.min(index, this.getCarouselItemCount() - 1));
         var scroll = this._getCarouselItemSize() * index;
         var max = this._calculateMaxScroll();

         this._scroll = Math.max(0, Math.min(max, scroll));
         return this._scrollTo(this._scroll, options).then(function () {
           _this2._tryFirePostChangeEvent();
           return _this2;
         });
       }

       /**
        * @method getActiveCarouselItemIndex
        * @signature getActiveCarouselItemIndex()
        * @return {Number}
        *   [en]The current carousel item index.[/en]
        *   [ja]現在表示しているカルーセル要素のインデックスが返されます。[/ja]
        * @description
        *   [en]Returns the index of the currently visible ons-carousel-item.[/en]
        *   [ja]現在表示されているons-carousel-item要素のインデックスを返します。[/ja]
        */

     }, {
       key: 'getActiveCarouselItemIndex',
       value: function getActiveCarouselItemIndex() {
         var scroll = this._scroll;
         var count = this.getCarouselItemCount();
         var size = this._getCarouselItemSize();

         if (scroll < 0) {
           return 0;
         }

         var i = undefined;
         for (i = 0; i < count; i++) {
           if (size * i <= scroll && size * (i + 1) > scroll) {
             return i;
           }
         }

         // max carousel index
         return i;
       }

       /**
        * @method next
        * @signature next([options])
        * @param {Object} [options]
        *   [en][/en]
        *   [ja][/ja]
        * @param {Function} [options.callback]
        *   [en][/en]
        *   [ja][/ja]
        * @param {String} [options.animation]
        *   [en][/en]
        *   [ja][/ja]
        * @param {Object} [options.animationOptions]
        *   [en][/en]
        *   [ja][/ja]
        * @return {Promise}
        *   [en]Resolves to the carousel element[/en]
        *   [ja][/ja]
        * @description
        *   [en]Show next ons-carousel item.[/en]
        *   [ja]次のons-carousel-itemを表示します。[/ja]
        */

     }, {
       key: 'next',
       value: function next(options) {
         return this.setActiveCarouselItemIndex(this.getActiveCarouselItemIndex() + 1, options);
       }

       /**
        * @method prev
        * @signature prev([options])
        * @param {Object} [options]
        *   [en][/en]
        *   [ja][/ja]
        * @param {Function} [options.callback]
        *   [en][/en]
        *   [ja][/ja]
        * @param {String} [options.animation]
        *   [en][/en]
        *   [ja][/ja]
        * @param {Object} [options.animationOptions]
        *   [en][/en]
        *   [ja][/ja]
        * @return {Promise}
        *   [en]Resolves to the carousel element[/en]
        *   [ja][/ja]
        * @description
        *   [en]Show previous ons-carousel item.[/en]
        *   [ja]前のons-carousel-itemを表示します。[/ja]
        */

     }, {
       key: 'prev',
       value: function prev(options) {
         return this.setActiveCarouselItemIndex(this.getActiveCarouselItemIndex() - 1, options);
       }

       /**
        * @method setAutoScrollEnabled
        * @signature setAutoScrollEnabled(enabled)
        * @param {Boolean} enabled
        *   [en]If true auto scroll will be enabled.[/en]
        *   [ja]オートスクロールを有効にする場合にはtrueを渡します。[/ja]
        * @description
        *   [en]Enable or disable "auto-scroll" attribute.[/en]
        *   [ja]auto-scroll属性があるかどうかを設定します。[/ja]
        */

     }, {
       key: 'setAutoScrollEnabled',
       value: function setAutoScrollEnabled(enabled) {
         if (enabled) {
           this.setAttribute('auto-scroll', '');
         } else {
           this.removeAttribute('auto-scroll');
         }
       }

       /**
        * @method isAutoScrollEnabled
        * @signature isAutoScrollEnabled()
        * @return {Boolean}
        *   [en]true if auto scroll is enabled.[/en]
        *   [ja]オートスクロールが有効であればtrueを返します。[/ja]
        * @description
        *   [en]Returns whether the "auto-scroll" attribute is set or not.[/en]
        *   [ja]auto-scroll属性があるかどうかを返します。[/ja]
        */

     }, {
       key: 'isAutoScrollEnabled',
       value: function isAutoScrollEnabled() {
         return this.hasAttribute('auto-scroll');
       }

       /**
        * @method setDisabled
        * @signature setDisabled(disabled)
        * @param {Boolean} disabled
        *   [en]If true the carousel will be disabled.[/en]
        *   [ja]disabled状態にする場合にはtrueを指定します。[/ja]
        * @description
        *   [en]Disable or enable the dialog.[/en]
        *   [ja]disabled属性があるかどうかを設定します。[/ja]
        */

     }, {
       key: 'setDisabled',
       value: function setDisabled(disabled) {
         if (disabled) {
           this.setAttribute('disabled', '');
         } else {
           this.removeAttribute('disabled');
         }
       }

       /**
        * @method isDisabled
        * @signature isDisabled()
        * @return {Boolean}
        *   [en]Whether the carousel is disabled or not.[/en]
        *   [ja]disabled状態になっていればtrueを返します。[/ja]
        * @description
        *   [en]Returns whether the dialog is disabled or enabled.[/en]
        *   [ja]disabled属性があるかどうかを返します。[/ja]
        */

     }, {
       key: 'isDisabled',
       value: function isDisabled() {
         return this.hasAttribute('disabled');
       }

       /**
        * @method setOverscrollable
        * @signature setOverscrollable(overscrollable)
        * @param {Boolean} overscrollable
        *   [en]If true the carousel will be overscrollable.[/en]
        *   [ja]overscrollできるかどうかを指定します。[/ja]
        * @description
        *   [en]Set whether the carousel is overscrollable or not.[/en]
        *   [ja]overscroll属性があるかどうかを設定します。[/ja]
        */

     }, {
       key: 'setOverscrollable',
       value: function setOverscrollable(scrollable) {
         if (scrollable) {
           this.setAttribute('overscrollable', '');
         } else {
           this.removeAttribute('overscrollable');
         }
       }

       /**
        * @method isOverscrollable
        * @signature isOverscrollable()
        * @return {Boolean}
        *   [en]Whether the carousel is overscrollable or not.[/en]
        *   [ja]overscrollできればtrueを返します。[/ja]
        * @description
        *   [en]Returns whether the carousel is overscrollable or not.[/en]
        *   [ja]overscroll属性があるかどうかを返します。[/ja]
        */

     }, {
       key: 'isOverscrollable',
       value: function isOverscrollable() {
         return this.hasAttribute('overscrollable');
       }

       /**
        * @return {Boolean}
        */

     }, {
       key: '_isEnabledChangeEvent',
       value: function _isEnabledChangeEvent() {
         var elementSize = this._getElementSize();
         var carouselItemSize = this._getCarouselItemSize();

         return this.isAutoScrollEnabled() && elementSize === carouselItemSize;
       }

       /**
        * @return {Boolean}
        */

     }, {
       key: '_isVertical',
       value: function _isVertical() {
         return this.getAttribute('direction') === 'vertical';
       }
     }, {
       key: '_prepareEventListeners',
       value: function _prepareEventListeners() {
         this._gestureDetector = new GestureDetector(this, {
           dragMinDistance: 1
         });

         this._gestureDetector.on('drag dragleft dragright dragup dragdown swipe swipeleft swiperight swipeup swipedown', this._boundOnDrag);
         this._gestureDetector.on('dragend', this._boundOnDragEnd);

         window.addEventListener('resize', this._boundOnResize, true);
       }
     }, {
       key: '_removeEventListeners',
       value: function _removeEventListeners() {
         this._gestureDetector.off('drag dragleft dragright dragup dragdown swipe swipeleft swiperight swipeup swipedown', this._boundOnDrag);
         this._gestureDetector.off('dragend', this._boundOnDragEnd);
         this._gestureDetector.dispose();

         window.removeEventListener('resize', this._boundOnResize, true);
       }
     }, {
       key: '_tryFirePostChangeEvent',
       value: function _tryFirePostChangeEvent() {
         var currentIndex = this.getActiveCarouselItemIndex();

         if (this._lastActiveIndex !== currentIndex) {
           var lastActiveIndex = this._lastActiveIndex;
           this._lastActiveIndex = currentIndex;

           util.triggerElementEvent(this, 'postchange', {
             carousel: this,
             activeIndex: currentIndex,
             lastActiveIndex: lastActiveIndex
           });
         }
       }
     }, {
       key: '_onDrag',
       value: function _onDrag(event) {
         if (!this.isSwipeable()) {
           return;
         }

         var direction = event.gesture.direction;
         if (this._isVertical() && (direction === 'left' || direction === 'right') || !this._isVertical() && (direction === 'up' || direction === 'down')) {
           return;
         }

         event.stopPropagation();

         this._lastDragEvent = event;

         var scroll = this._scroll - this._getScrollDelta(event);
         this._scrollTo(scroll);
         event.gesture.preventDefault();

         this._tryFirePostChangeEvent();
       }
     }, {
       key: '_onDragEnd',
       value: function _onDragEnd(event) {
         var _this3 = this;

         this._currentElementSize = undefined;

         if (!this.isSwipeable()) {
           return;
         }

         this._scroll = this._scroll - this._getScrollDelta(event);

         if (this._getScrollDelta(event) !== 0) {
           event.stopPropagation();
         }

         if (this._isOverScroll(this._scroll)) {
           var waitForAction = false;
           util.triggerElementEvent(this, 'overscroll', {
             carousel: this,
             activeIndex: this.getActiveCarouselItemIndex(),
             direction: this._getOverScrollDirection(),
             waitToReturn: function waitToReturn(promise) {
               waitForAction = true;
               promise.then(function () {
                 return _this3._scrollToKillOverScroll();
               });
             }
           });

           if (!waitForAction) {
             this._scrollToKillOverScroll();
           }
         } else {
           this._startMomentumScroll();
         }
         this._lastDragEvent = null;

         event.gesture.preventDefault();
       }

       /**
        * @param {Object} trait
        */

     }, {
       key: '_mixin',
       value: function _mixin(trait) {
         Object.keys(trait).forEach((function (key) {
           this[key] = trait[key];
         }).bind(this));
       }
     }, {
       key: '_startMomentumScroll',
       value: function _startMomentumScroll() {
         if (this._lastDragEvent) {
           var velocity = this._getScrollVelocity(this._lastDragEvent);
           var duration = 0.3;
           var scrollDelta = duration * 100 * velocity;
           var scroll = this._normalizeScrollPosition(this._scroll + (this._getScrollDelta(this._lastDragEvent) > 0 ? -scrollDelta : scrollDelta));

           this._scroll = scroll;

           animit(this._getCarouselItemElements()).queue({
             transform: this._generateScrollTransform(this._scroll)
           }, {
             duration: duration,
             timing: 'cubic-bezier(.1, .7, .1, 1)'
           }).queue((function (done) {
             done();
             this._tryFirePostChangeEvent();
           }).bind(this)).play();
         }
       }
     }, {
       key: '_normalizeScrollPosition',
       value: function _normalizeScrollPosition(scroll) {
         var _this4 = this;

         var max = this._calculateMaxScroll();

         if (this.isAutoScrollEnabled()) {
           var _ret = (function () {
             var arr = [];
             var size = _this4._getCarouselItemSize();
             var nbrOfItems = _this4.getCarouselItemCount();

             for (var i = 0; i < nbrOfItems; i++) {
               if (max >= i * size) {
                 arr.push(i * size);
               }
             }
             arr.push(max);

             arr.sort(function (left, right) {
               left = Math.abs(left - scroll);
               right = Math.abs(right - scroll);

               return left - right;
             });

             arr = arr.filter(function (item, pos) {
               return !pos || item != arr[pos - 1];
             });

             var lastScroll = _this4._lastActiveIndex * size;
             var scrollRatio = Math.abs(scroll - lastScroll) / size;

             if (scrollRatio <= _this4.getAutoScrollRatio()) {
               return {
                 v: lastScroll
               };
             } else if (scrollRatio > _this4.getAutoScrollRatio() && scrollRatio < 1.0) {
               if (arr[0] === lastScroll && arr.length > 1) {
                 return {
                   v: arr[1]
                 };
               }
             }

             return {
               v: arr[0]
             };
           })();

           if ((typeof _ret === 'undefined' ? 'undefined' : babelHelpers.typeof(_ret)) === "object") return _ret.v;
         } else {
           return Math.max(0, Math.min(max, scroll));
         }
       }

       /**
        * @return {Array}
        */

     }, {
       key: '_getCarouselItemElements',
       value: function _getCarouselItemElements() {
         return util.arrayFrom(this.children).filter(function (child) {
           return child.nodeName.toLowerCase() === 'ons-carousel-item';
         });
       }

       /**
        * @param {Number} scroll
        * @param {Object} [options]
        * @return {Promise} Resolves to the carousel element
        */

     }, {
       key: '_scrollTo',
       value: function _scrollTo(scroll) {
         var _this5 = this;

         var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

         var isOverscrollable = this.isOverscrollable();

         var normalizeScroll = function normalizeScroll(scroll) {
           var ratio = 0.35;

           if (scroll < 0) {
             return isOverscrollable ? Math.round(scroll * ratio) : 0;
           }

           var maxScroll = _this5._calculateMaxScroll();
           if (maxScroll < scroll) {
             return isOverscrollable ? maxScroll + Math.round((scroll - maxScroll) * ratio) : maxScroll;
           }

           return scroll;
         };

         return new Promise(function (resolve) {
           animit(_this5._getCarouselItemElements()).queue({
             transform: _this5._generateScrollTransform(normalizeScroll(scroll))
           }, options.animation !== 'none' ? options.animationOptions : {}).play(function () {
             if (options.callback instanceof Function) {
               options.callback();
             }
             resolve();
           });
         });
       }
     }, {
       key: '_calculateMaxScroll',
       value: function _calculateMaxScroll() {
         var max = this.getCarouselItemCount() * this._getCarouselItemSize() - this._getElementSize();
         return Math.ceil(max < 0 ? 0 : max); // Need to return an integer value.
       }
     }, {
       key: '_isOverScroll',
       value: function _isOverScroll(scroll) {
         if (scroll < 0 || scroll > this._calculateMaxScroll()) {
           return true;
         }
         return false;
       }
     }, {
       key: '_getOverScrollDirection',
       value: function _getOverScrollDirection() {
         if (this._isVertical()) {
           if (this._scroll <= 0) {
             return 'up';
           } else {
             return 'down';
           }
         } else {
           if (this._scroll <= 0) {
             return 'left';
           } else {
             return 'right';
           }
         }
       }
     }, {
       key: '_scrollToKillOverScroll',
       value: function _scrollToKillOverScroll() {
         var duration = 0.4;

         if (this._scroll < 0) {
           animit(this._getCarouselItemElements()).queue({
             transform: this._generateScrollTransform(0)
           }, {
             duration: duration,
             timing: 'cubic-bezier(.1, .4, .1, 1)'
           }).queue((function (done) {
             done();
             this._tryFirePostChangeEvent();
           }).bind(this)).play();
           this._scroll = 0;
           return;
         }

         var maxScroll = this._calculateMaxScroll();

         if (maxScroll < this._scroll) {
           animit(this._getCarouselItemElements()).queue({
             transform: this._generateScrollTransform(maxScroll)
           }, {
             duration: duration,
             timing: 'cubic-bezier(.1, .4, .1, 1)'
           }).queue((function (done) {
             done();
             this._tryFirePostChangeEvent();
           }).bind(this)).play();
           this._scroll = maxScroll;
           return;
         }

         return;
       }

       /**
        * @method getCarouselItemCount
        * @signature getCarouselItemCount)
        * @return {Number}
        *   [en]The number of carousel items.[/en]
        *   [ja]カルーセル要素の数です。[/ja]
        * @description
        *   [en]Returns the current number of carousel items..[/en]
        *   [ja]現在のカルーセル要素を数を返します。[/ja]
        */

     }, {
       key: 'getCarouselItemCount',
       value: function getCarouselItemCount() {
         return this._getCarouselItemElements().length;
       }

       /**
        * @method refresh
        * @signature refresh()
        * @description
        *   [en]Update the layout of the carousel. Used when adding ons-carousel-items dynamically or to automatically adjust the size.[/en]
        *   [ja]レイアウトや内部の状態を最新のものに更新します。ons-carousel-itemを動的に増やしたり、ons-carouselの大きさを動的に変える際に利用します。[/ja]
       */

     }, {
       key: 'refresh',
       value: function refresh() {
         // Bug fix
         if (this._getCarouselItemSize() === 0) {
           return;
         }

         this._mixin(this._isVertical() ? VerticalModeTrait : HorizontalModeTrait);
         this._layoutCarouselItems();

         if (this._lastState && this._lastState.width > 0) {
           var scroll = this._scroll;

           if (this._isOverScroll(scroll)) {
             this._scrollToKillOverScroll();
           } else {
             if (this.isAutoScrollEnabled()) {
               scroll = this._normalizeScrollPosition(scroll);
             }

             this._scrollTo(scroll);
           }
         }

         this._saveLastState();

         util.triggerElementEvent(this, 'refresh', { carousel: this });
       }

       /**
        * @method first
        * @signature first()
        * @return {Promise}
        *   [en]Resolves to the carousel element[/en]
        *   [ja][/ja]
        * @description
        *   [en]Show first ons-carousel item.[/en]
        *   [ja]最初のons-carousel-itemを表示します。[/ja]
        */

     }, {
       key: 'first',
       value: function first(options) {
         return this.setActiveCarouselItemIndex(0, options);
       }

       /**
        * @method last
        * @signature last()
        * @return {Promise}
        *   [en]Resolves to the carousel element[/en]
        *   [ja]Resolves to the carousel element[/ja]
        * @description
        *   [en]Show last ons-carousel item.[/en]
        *   [ja]最後のons-carousel-itemを表示します。[/ja]
        */

     }, {
       key: 'last',
       value: function last(options) {
         this.setActiveCarouselItemIndex(Math.max(this.getCarouselItemCount() - 1, 0), options);
       }
     }, {
       key: 'attachedCallback',
       value: function attachedCallback() {
         this._prepareEventListeners();

         this._layoutCarouselItems();
         this._setupInitialIndex();

         this._saveLastState();
       }
     }, {
       key: 'attributeChangedCallback',
       value: function attributeChangedCallback(name, last, current) {
         if (name === 'modifier') {
           return ModifierUtil.onModifierChanged(last, current, this, scheme$4);
         } else if (name === 'direction') {
           this._onDirectionChange();
         }
       }
     }, {
       key: 'detachedCallback',
       value: function detachedCallback() {
         this._removeEventListeners();
       }
     }]);
     return CarouselElement;
   })(BaseElement);

   window.OnsCarouselElement = document.registerElement('ons-carousel', {
     prototype: CarouselElement.prototype
   });

   /**
    * @element ons-col
    * @category grid
    * @description
    *   [en]Represents a column in the grid system. Use with ons-row to layout components.[/en]
    *   [ja]グリッドシステムにて列を定義します。ons-rowとともに使用し、コンポーネントのレイアウトに利用します。[/ja]
    * @note
    *   [en]For Android 4.3 and earlier, and iOS6 and earlier, when using mixed alignment with ons-row and ons-column, they may not be displayed correctly. You can use only one align.[/en]
    *   [ja]Android 4.3以前、もしくはiOS 6以前のOSの場合、ons-rowとons-columnを組み合わせた場合に描画が崩れる場合があります。[/ja]
    * @codepen GgujC {wide}
    * @guide layouting [en]Layouting guide[/en][ja]レイアウト機能[/ja]
    * @seealso ons-row [en]ons-row component[/en][ja]ons-rowコンポーネント[/ja]
    * @example
    * <ons-row>
    *   <ons-col width="50px"><ons-icon icon="fa-twitter"></ons-icon></ons-col>
    *   <ons-col>Text</ons-col>
    * </ons-row>
    */

   /**
    * @attribute vertical-align
    * @type {String}
    * @description
    *   [en]Vertical alignment of the column. Valid values are "top", "center", and "bottom".[/en]
    *   [ja]縦の配置を指定する。"top", "center", "bottom"のいずれかを指定します。[/ja]
    */

   /**
    * @attribute width
    * @type {String}
    * @description
    *   [en]The width of the column. Valid values are css width values ("10%", "50px").[/en]
    *   [ja]カラムの横幅を指定する。パーセントもしくはピクセルで指定します（10%や50px）。[/ja]
    */

   var ColumnElement = (function (_BaseElement) {
     babelHelpers.inherits(ColumnElement, _BaseElement);

     function ColumnElement() {
       babelHelpers.classCallCheck(this, ColumnElement);
       return babelHelpers.possibleConstructorReturn(this, Object.getPrototypeOf(ColumnElement).apply(this, arguments));
     }

     babelHelpers.createClass(ColumnElement, [{
       key: 'createdCallback',
       value: function createdCallback() {
         if (this.getAttribute('width')) {
           this._updateWidth();
         }
       }
     }, {
       key: 'attributeChangedCallback',
       value: function attributeChangedCallback(name, last, current) {
         if (name === 'width') {
           this._updateWidth();
         }
       }
     }, {
       key: '_updateWidth',
       value: function _updateWidth() {
         var width = this.getAttribute('width');
         if (typeof width === 'string') {
           width = ('' + width).trim();
           width = width.match(/^\d+$/) ? width + '%' : width;

           this.style.webkitBoxFlex = '0';
           this.style.webkitFlex = '0 0 ' + width;
           this.style.mozBoxFlex = '0';
           this.style.mozFlex = '0 0 ' + width;
           this.style.msFlex = '0 0 ' + width;
           this.style.flex = '0 0 ' + width;
           this.style.maxWidth = width;
         }
       }
     }]);
     return ColumnElement;
   })(BaseElement);

   window.OnsColElement = document.registerElement('ons-col', {
     prototype: ColumnElement.prototype
   });

   /*
   Copyright 2013-2015 ASIAL CORPORATION

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.

   */

   var DialogAnimator = (function () {
     function DialogAnimator() {
       var _ref = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

       var _ref$timing = _ref.timing;
       var timing = _ref$timing === undefined ? 'linear' : _ref$timing;
       var _ref$delay = _ref.delay;
       var delay = _ref$delay === undefined ? 0 : _ref$delay;
       var _ref$duration = _ref.duration;
       var duration = _ref$duration === undefined ? 0.2 : _ref$duration;
       babelHelpers.classCallCheck(this, DialogAnimator);

       this.timing = timing;
       this.delay = delay;
       this.duration = duration;
     }

     /**
      * @param {HTMLElement} dialog
      * @param {Function} done
      */

     babelHelpers.createClass(DialogAnimator, [{
       key: 'show',
       value: function show(dialog, done) {
         done();
       }

       /**
        * @param {HTMLElement} dialog
        * @param {Function} done
        */

     }, {
       key: 'hide',
       value: function hide(dialog, done) {
         done();
       }
     }]);
     return DialogAnimator;
   })();

   /**
    * Android style animator for dialog.
    */
   var AndroidDialogAnimator = (function (_DialogAnimator) {
     babelHelpers.inherits(AndroidDialogAnimator, _DialogAnimator);

     function AndroidDialogAnimator() {
       var _ref2 = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

       var _ref2$timing = _ref2.timing;
       var timing = _ref2$timing === undefined ? 'ease-in-out' : _ref2$timing;
       var _ref2$delay = _ref2.delay;
       var delay = _ref2$delay === undefined ? 0 : _ref2$delay;
       var _ref2$duration = _ref2.duration;
       var duration = _ref2$duration === undefined ? 0.3 : _ref2$duration;
       babelHelpers.classCallCheck(this, AndroidDialogAnimator);
       return babelHelpers.possibleConstructorReturn(this, Object.getPrototypeOf(AndroidDialogAnimator).call(this, { timing: timing, delay: delay, duration: duration }));
     }

     /**
      * @param {Object} dialog
      * @param {Function} callback
      */

     babelHelpers.createClass(AndroidDialogAnimator, [{
       key: 'show',
       value: function show(dialog, callback) {
         callback = callback ? callback : function () {};

         animit.runAll(animit(dialog._mask).queue({
           opacity: 0
         }).wait(this.delay).queue({
           opacity: 1.0
         }, {
           duration: this.duration,
           timing: this.timing
         }), animit(dialog._dialog).saveStyle().queue({
           css: {
             transform: 'translate3d(-50%, -60%, 0)',
             opacity: 0.0
           },
           duration: 0
         }).wait(this.delay).queue({
           css: {
             transform: 'translate3d(-50%, -50%, 0)',
             opacity: 1.0
           },
           duration: this.duration,
           timing: this.timing
         }).restoreStyle().queue(function (done) {
           callback();
           done();
         }));
       }

       /**
        * @param {Object} dialog
        * @param {Function} callback
        */

     }, {
       key: 'hide',
       value: function hide(dialog, callback) {
         callback = callback ? callback : function () {};

         animit.runAll(animit(dialog._mask).queue({
           opacity: 1.0
         }).wait(this.delay).queue({
           opacity: 0
         }, {
           duration: this.duration,
           timing: this.timing
         }), animit(dialog._dialog).saveStyle().queue({
           css: {
             transform: 'translate3d(-50%, -50%, 0)',
             opacity: 1.0
           },
           duration: 0
         }).wait(this.delay).queue({
           css: {
             transform: 'translate3d(-50%, -60%, 0)',
             opacity: 0.0
           },
           duration: this.duration,
           timing: this.timing
         }).restoreStyle().queue(function (done) {
           callback();
           done();
         }));
       }
     }]);
     return AndroidDialogAnimator;
   })(DialogAnimator);

   /**
    * iOS style animator for dialog.
    */
   var IOSDialogAnimator = (function (_DialogAnimator2) {
     babelHelpers.inherits(IOSDialogAnimator, _DialogAnimator2);

     function IOSDialogAnimator() {
       var _ref3 = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

       var _ref3$timing = _ref3.timing;
       var timing = _ref3$timing === undefined ? 'ease-in-out' : _ref3$timing;
       var _ref3$delay = _ref3.delay;
       var delay = _ref3$delay === undefined ? 0 : _ref3$delay;
       var _ref3$duration = _ref3.duration;
       var duration = _ref3$duration === undefined ? 0.3 : _ref3$duration;
       babelHelpers.classCallCheck(this, IOSDialogAnimator);
       return babelHelpers.possibleConstructorReturn(this, Object.getPrototypeOf(IOSDialogAnimator).call(this, { timing: timing, delay: delay, duration: duration }));
     }

     /**
      * @param {Object} dialog
      * @param {Function} callback
      */

     babelHelpers.createClass(IOSDialogAnimator, [{
       key: 'show',
       value: function show(dialog, callback) {
         callback = callback ? callback : function () {};

         animit.runAll(animit(dialog._mask).queue({
           opacity: 0
         }).wait(this.delay).queue({
           opacity: 1.0
         }, {
           duration: this.duration,
           timing: this.timing
         }), animit(dialog._dialog).saveStyle().queue({
           css: {
             transform: 'translate3d(-50%, 300%, 0)'
           },
           duration: 0
         }).wait(this.delay).queue({
           css: {
             transform: 'translate3d(-50%, -50%, 0)'
           },
           duration: this.duration,
           timing: this.timing
         }).restoreStyle().queue(function (done) {
           callback();
           done();
         }));
       }

       /**
        * @param {Object} dialog
        * @param {Function} callback
        */

     }, {
       key: 'hide',
       value: function hide(dialog, callback) {
         callback = callback ? callback : function () {};

         animit.runAll(animit(dialog._mask).queue({
           opacity: 1.0
         }).wait(this.delay).queue({
           opacity: 0
         }, {
           duration: this.duration,
           timing: this.timing
         }), animit(dialog._dialog).saveStyle().queue({
           css: {
             transform: 'translate3d(-50%, -50%, 0)'
           },
           duration: 0
         }).wait(this.delay).queue({
           css: {
             transform: 'translate3d(-50%, 300%, 0)'
           },
           duration: this.duration,
           timing: this.timing
         }).restoreStyle().queue(function (done) {
           callback();
           done();
         }));
       }
     }]);
     return IOSDialogAnimator;
   })(DialogAnimator);

   /**
    * Slide animator for dialog.
    */
   var SlideDialogAnimator = (function (_DialogAnimator3) {
     babelHelpers.inherits(SlideDialogAnimator, _DialogAnimator3);

     function SlideDialogAnimator() {
       var _ref4 = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

       var _ref4$timing = _ref4.timing;
       var timing = _ref4$timing === undefined ? 'cubic-bezier(.1, .7, .4, 1)' : _ref4$timing;
       var _ref4$delay = _ref4.delay;
       var delay = _ref4$delay === undefined ? 0 : _ref4$delay;
       var _ref4$duration = _ref4.duration;
       var duration = _ref4$duration === undefined ? 0.2 : _ref4$duration;
       babelHelpers.classCallCheck(this, SlideDialogAnimator);
       return babelHelpers.possibleConstructorReturn(this, Object.getPrototypeOf(SlideDialogAnimator).call(this, { timing: timing, delay: delay, duration: duration }));
     }

     /**
      * @param {Object} dialog
      * @param {Function} callback
      */

     babelHelpers.createClass(SlideDialogAnimator, [{
       key: 'show',
       value: function show(dialog, callback) {
         callback = callback ? callback : function () {};

         animit.runAll(animit(dialog._mask).queue({
           opacity: 0
         }).wait(this.delay).queue({
           opacity: 1.0
         }, {
           duration: this.duration,
           timing: this.timing
         }), animit(dialog._dialog).saveStyle().queue({
           css: {
             transform: 'translate3D(-50%, -350%, 0)'
           },
           duration: 0
         }).wait(this.delay).queue({
           css: {
             transform: 'translate3D(-50%, -50%, 0)'
           },
           duration: this.duration,
           timing: this.timing
         }).restoreStyle().queue(function (done) {
           callback();
           done();
         }));
       }

       /**
        * @param {Object} dialog
        * @param {Function} callback
        */

     }, {
       key: 'hide',
       value: function hide(dialog, callback) {
         callback = callback ? callback : function () {};

         animit.runAll(animit(dialog._mask).queue({
           opacity: 1.0
         }).wait(this.delay).queue({
           opacity: 0
         }, {
           duration: this.duration,
           timing: this.timing
         }), animit(dialog._dialog).saveStyle().queue({
           css: {
             transform: 'translate3D(-50%, -50%, 0)'
           },
           duration: 0
         }).wait(this.delay).queue({
           css: {
             transform: 'translate3D(-50%, -350%, 0)'
           },
           duration: this.duration,
           timing: this.timing
         }).restoreStyle().queue(function (done) {
           callback();
           done();
         }));
       }
     }]);
     return SlideDialogAnimator;
   })(DialogAnimator);

   var scheme$21 = {
     '.dialog': 'dialog--*',
     '.dialog-container': 'dialog-container--*',
     '.dialog-mask': 'dialog-mask--*'
   };

   var templateSource$2 = util.createElement('\n  <div>\n    <div class="dialog-mask"></div>\n    <div class="dialog">\n      <div class="dialog-container"></div>\n    </div>\n  </div>\n');

   var _animatorDict$1 = {
     'default': function _default() {
       return platform.isAndroid() ? AndroidDialogAnimator : IOSDialogAnimator;
     },
     'fade': function fade() {
       return platform.isAndroid() ? AndroidDialogAnimator : IOSDialogAnimator;
     },
     'slide': SlideDialogAnimator,
     'none': DialogAnimator
   };

   /**
    * @element ons-dialog
    * @category dialog
    * @modifier material
    *   [en]Display a Material Design dialog.[/en]
    *   [ja]マテリアルデザインのダイアログを表示します。[/ja]
    * @description
    *  [en]Dialog that is displayed on top of current screen.[/en]
    *  [ja]現在のスクリーンにダイアログを表示します。[/ja]
    * @codepen zxxaGa
    * @guide UsingDialog
    *   [en]Learn how to use the dialog component.[/en]
    *   [ja]ダイアログコンポーネントの使い方[/ja]
    * @seealso ons-alert-dialog
    *   [en]ons-alert-dialog component[/en]
    *   [ja]ons-alert-dialogコンポーネント[/ja]
    * @seealso ons-popover
    *   [en]ons-popover component[/en]
    *   [ja]ons-popoverコンポーネント[/ja]
    * @example
    * <script>
    *   ons.ready(function() {
    *     ons.createDialog('dialog.html').then(function(dialog) {
    *       dialog.show();
    *     });
    *   });
    * </script>
    *
    * <script type="text/ons-template" id="dialog.html">
    *   <ons-dialog cancelable>
    *     ...
    *   </ons-dialog>
    * </script>
    */

   var DialogElement = (function (_BaseElement) {
     babelHelpers.inherits(DialogElement, _BaseElement);

     function DialogElement() {
       babelHelpers.classCallCheck(this, DialogElement);
       return babelHelpers.possibleConstructorReturn(this, Object.getPrototypeOf(DialogElement).apply(this, arguments));
     }

     babelHelpers.createClass(DialogElement, [{
       key: 'createdCallback',
       value: function createdCallback() {
         if (!this.hasAttribute('_compiled')) {
           this._compile();
         }

         this._visible = false;
         this._doorLock = new DoorLock();
         this._boundCancel = this._cancel.bind(this);

         this._animatorFactory = new AnimatorFactory({
           animators: _animatorDict$1,
           baseClass: DialogAnimator,
           baseClassName: 'DialogAnimator',
           defaultAnimation: this.getAttribute('animation')
         });
       }
     }, {
       key: '_compile',
       value: function _compile() {
         ons$1._autoStyle.prepare(this);

         var style = this.getAttribute('style');

         this.style.display = 'none';

         var template = templateSource$2.cloneNode(true);
         var dialog = template.children[1];

         if (style) {
           dialog.setAttribute('style', style);
         }

         while (this.firstChild) {
           dialog.children[0].appendChild(this.firstChild);
         }

         while (template.firstChild) {
           this.appendChild(template.firstChild);
         }

         this._dialog.style.zIndex = 20001;
         this._mask.style.zIndex = 20000;

         this.setAttribute('no-status-bar-fill', '');

         ModifierUtil.initModifier(this, scheme$21);

         this.setAttribute('_compiled', '');
       }

       /**
        * @method getDeviceBackButtonHandler
        * @signature getDeviceBackButtonHandler()
        * @return {Object/null}
        *   [en]Device back button handler.[/en]
        *   [ja]デバイスのバックボタンハンドラを返します。[/ja]
        * @description
        *   [en]Retrieve the back button handler for overriding the default behavior.[/en]
        *   [ja]バックボタンハンドラを取得します。デフォルトの挙動を変更することができます。[/ja]
        */

     }, {
       key: 'getDeviceBackButtonHandler',
       value: function getDeviceBackButtonHandler() {
         return this._deviceBackButtonHandler;
       }
     }, {
       key: '_onDeviceBackButton',
       value: function _onDeviceBackButton(event) {
         if (this.isCancelable()) {
           this._cancel();
         } else {
           event.callParentHandler();
         }
       }
     }, {
       key: '_cancel',
       value: function _cancel() {
         var _this2 = this;

         if (this.isCancelable()) {
           this.hide({
             callback: function callback() {
               util.triggerElementEvent(_this2, 'cancel');
             }
           });
         }
       }

       /**
        * @method show
        * @signature show([options])
        * @param {Object} [options]
        *   [en]Parameter object.[/en]
        *   [ja]オプションを指定するオブジェクト。[/ja]
        * @param {String} [options.animation]
        *   [en]Animation name. Available animations are "none", "fade" and "slide".[/en]
        *   [ja]アニメーション名を指定します。"none", "fade", "slide"のいずれかを指定します。[/ja]
        * @param {String} [options.animationOptions]
        *   [en]Specify the animation's duration, delay and timing. E.g.  <code>{duration: 0.2, delay: 0.4, timing: 'ease-in'}</code>[/en]
        *   [ja]アニメーション時のduration, delay, timingを指定します。e.g. <code>{duration: 0.2, delay: 0.4, timing: 'ease-in'}</code> [/ja]
        * @param {Function} [options.callback]
        *   [en]This function is called after the dialog has been revealed.[/en]
        *   [ja]ダイアログが表示され終わった後に呼び出される関数オブジェクトを指定します。[/ja]
        * @description
        *  [en]Show the dialog.[/en]
        *  [ja]ダイアログを開きます。[/ja]
        * @return {Promise} Resolves to the displayed element.
        */

     }, {
       key: 'show',
       value: function show() {
         var _this3 = this;

         var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

         var _cancel2 = false;
         var callback = options.callback || function () {};

         options.animationOptions = util.extend(options.animationOptions || {}, AnimatorFactory.parseAnimationOptionsString(this.getAttribute('animation-options')));

         util.triggerElementEvent(this, 'preshow', {
           dialog: this,
           cancel: function cancel() {
             _cancel2 = true;
           }
         });

         if (!_cancel2) {
           var _ret = (function () {
             var tryShow = function tryShow() {
               var unlock = _this3._doorLock.lock();
               var animator = _this3._animatorFactory.newAnimator(options);

               _this3.style.display = 'block';
               _this3._mask.style.opacity = '1';

               return new Promise(function (resolve) {
                 animator.show(_this3, function () {
                   _this3._visible = true;
                   unlock();

                   util.triggerElementEvent(_this3, 'postshow', { dialog: _this3 });

                   callback();
                   resolve(_this3);
                 });
               });
             };

             return {
               v: new Promise(function (resolve) {
                 _this3._doorLock.waitUnlock(function () {
                   return resolve(tryShow());
                 });
               })
             };
           })();

           if ((typeof _ret === 'undefined' ? 'undefined' : babelHelpers.typeof(_ret)) === "object") return _ret.v;
         } else {
           return Promise.reject('Canceled in preshow event.');
         }
       }

       /**
        * @method hide
        * @signature hide([options])
        * @param {Object} [options]
        *   [en]Parameter object.[/en]
        *   [ja]オプションを指定するオブジェクト。[/ja]
        * @param {String} [options.animation]
        *   [en]Animation name. Available animations are "none", "fade" and "slide".[/en]
        *   [ja]アニメーション名を指定します。"none", "fade", "slide"のいずれかを指定できます。[/ja]
        * @param {String} [options.animationOptions]
        *   [en]Specify the animation's duration, delay and timing. E.g.  <code>{duration: 0.2, delay: 0.4, timing: 'ease-in'}</code>[/en]
        *   [ja]アニメーション時のduration, delay, timingを指定します。e.g. <code>{duration: 0.2, delay: 0.4, timing: 'ease-in'}</code> [/ja]
        * @param {Function} [options.callback]
        *   [en]This functions is called after the dialog has been hidden.[/en]
        *   [ja]ダイアログが隠れた後に呼び出される関数オブジェクトを指定します。[/ja]
        * @description
        *   [en]Hide the dialog.[/en]
        *   [ja]ダイアログを閉じます。[/ja]
        * @return {Promise}
        *   [en]Resolves to the hidden element[/en]
        *   [ja][/ja]
        */

     }, {
       key: 'hide',
       value: function hide() {
         var _this4 = this;

         var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

         var _cancel3 = false;
         var callback = options.callback || function () {};

         options.animationOptions = util.extend(options.animationOptions || {}, AnimatorFactory.parseAnimationOptionsString(this.getAttribute('animation-options')));

         util.triggerElementEvent(this, 'prehide', {
           dialog: this,
           cancel: function cancel() {
             _cancel3 = true;
           }
         });

         if (!_cancel3) {
           var _ret2 = (function () {
             var tryHide = function tryHide() {
               var unlock = _this4._doorLock.lock();
               var animator = _this4._animatorFactory.newAnimator(options);

               return new Promise(function (resolve) {
                 animator.hide(_this4, function () {
                   _this4.style.display = 'none';
                   _this4._visible = false;
                   unlock();

                   util.triggerElementEvent(_this4, 'posthide', { dialog: _this4 });

                   callback();
                   resolve(_this4);
                 });
               });
             };

             return {
               v: new Promise(function (resolve) {
                 _this4._doorLock.waitUnlock(function () {
                   return resolve(tryHide());
                 });
               })
             };
           })();

           if ((typeof _ret2 === 'undefined' ? 'undefined' : babelHelpers.typeof(_ret2)) === "object") return _ret2.v;
         } else {
           return Promise.reject('Canceled in prehide event.');
         }
       }

       /**
        * @method destroy
        * @signature destroy()
        * @description
        *  [en]Destroy the dialog and remove it from the DOM tree.[/en]
        *  [ja]ダイアログを破棄して、DOMツリーから取り除きます。[/ja]
        */

     }, {
       key: 'destroy',
       value: function destroy() {
         if (this.parentElement) {
           this.parentElement.removeChild(this);
         }
       }

       /**
        * @method isShown
        * @signature isShown()
        * @description
        *   [en]Returns whether the dialog is visible or not.[/en]
        *   [ja]ダイアログが表示されているかどうかを返します。[/ja]
        * @return {Boolean}
        *   [en]true if the dialog is visible.[/en]
        *   [ja]ダイアログが表示されている場合にtrueを返します。[/ja]
        */

     }, {
       key: 'isShown',
       value: function isShown() {
         return this._visible;
       }

       /**
        * @method isCancelable
        * @signature isCancelable()
        * @description
        *   [en]Returns whether the dialog is cancelable or not.[/en]
        *   [ja]このダイアログがキャンセル可能かどうかを返します。[/ja]
        * @return {Boolean}
        *   [en]true if the dialog is cancelable.[/en]
        *   [ja]ダイアログがキャンセル可能な場合trueを返します。[/ja]
        */

     }, {
       key: 'isCancelable',
       value: function isCancelable() {
         return this.hasAttribute('cancelable');
       }

       /**
        * @method setDisabled
        * @signature setDisabled(disabled)
        * @description
        *   [en]Disable or enable the dialog.[/en]
        *   [ja]このダイアログをdisabled状態にするかどうかを設定します。[/ja]
        * @param {Boolean} disabled
        *   [en]If true the dialog will be disabled.[/en]
        *   [ja]trueを指定するとダイアログをdisabled状態になります。[/ja]
        */

     }, {
       key: 'setDisabled',
       value: function setDisabled(disabled) {
         if (typeof disabled !== 'boolean') {
           throw new Error('Argument must be a boolean.');
         }

         if (disabled) {
           this.setAttribute('disabled', '');
         } else {
           this.removeAttribute('disabled');
         }
       }

       /**
        * @method isDisabled
        * @signature isDisabled()
        * @description
        *   [en]Returns whether the dialog is disabled or enabled.[/en]
        *   [ja]このダイアログがdisabled状態かどうかを返します。[/ja]
        * @return {Boolean}
        *   [en]true if the dialog is disabled.[/en]
        *   [ja]ダイアログがdisabled状態の場合trueを返します。[/ja]
        */

     }, {
       key: 'isDisabled',
       value: function isDisabled() {
         return this.hasAttribute('disabled');
       }

       /**
        * @method setCancelable
        * @signature setCancelable(cancelable)
        * @param {Boolean} cancelable
        *   [en]If true the dialog will be cancelable.[/en]
        *   [ja]ダイアログをキャンセル可能にする場合trueを指定します。[/ja]
        * @description
        *   [en]Define whether the dialog can be canceled by the user or not.[/en]
        *   [ja]ダイアログを表示した際に、ユーザがそのダイアログをキャンセルできるかどうかを指定します。[/ja]
        */

     }, {
       key: 'setCancelable',
       value: function setCancelable(cancelable) {
         if (typeof cancelable !== 'boolean') {
           throw new Error('Argument must be a boolean.');
         }

         if (cancelable) {
           this.setAttribute('cancelable', '');
         } else {
           this.removeAttribute('cancelable');
         }
       }
     }, {
       key: 'attachedCallback',
       value: function attachedCallback() {
         this._deviceBackButtonHandler = deviceBackButtonDispatcher.createHandler(this, this._onDeviceBackButton.bind(this));

         this._mask.addEventListener('click', this._boundCancel, false);
       }
     }, {
       key: 'detachedCallback',
       value: function detachedCallback() {
         this._deviceBackButtonHandler.destroy();
         this._deviceBackButtonHandler = null;

         this._mask.removeEventListener('click', this._boundCancel.bind(this), false);
       }
     }, {
       key: 'attributeChangedCallback',
       value: function attributeChangedCallback(name, last, current) {
         if (name === 'modifier') {
           return ModifierUtil.onModifierChanged(last, current, this, scheme$21);
         }
       }
     }, {
       key: '_mask',

       /**
        * @event preshow
        * @description
        * [en]Fired just before the dialog is displayed.[/en]
        * [ja]ダイアログが表示される直前に発火します。[/ja]
        * @param {Object} event [en]Event object.[/en]
        * @param {Object} event.dialog
        *   [en]Component object.[/en]
        *   [ja]コンポーネントのオブジェクト。[/ja]
        * @param {Function} event.cancel
        *   [en]Execute this function to stop the dialog from being shown.[/en]
        *   [ja]この関数を実行すると、ダイアログの表示がキャンセルされます。[/ja]
        */

       /**
        * @event postshow
        * @description
        * [en]Fired just after the dialog is displayed.[/en]
        * [ja]ダイアログが表示された直後に発火します。[/ja]
        * @param {Object} event [en]Event object.[/en]
        * @param {Object} event.dialog
        *   [en]Component object.[/en]
        *   [ja]コンポーネントのオブジェクト。[/ja]
        */

       /**
        * @event prehide
        * @description
        * [en]Fired just before the dialog is hidden.[/en]
        * [ja]ダイアログが隠れる直前に発火します。[/ja]
        * @param {Object} event [en]Event object.[/en]
        * @param {Object} event.dialog
        *   [en]Component object.[/en]
        *   [ja]コンポーネントのオブジェクト。[/ja]
        * @param {Function} event.cancel
        *   [en]Execute this function to stop the dialog from being hidden.[/en]
        *   [ja]この関数を実行すると、ダイアログの非表示がキャンセルされます。[/ja]
        */

       /**
        * @event posthide
        * @description
        * [en]Fired just after the dialog is hidden.[/en]
        * [ja]ダイアログが隠れた後に発火します。[/ja]
        * @param {Object} event [en]Event object.[/en]
        * @param {Object} event.dialog
        *   [en]Component object.[/en]
        *   [ja]コンポーネントのオブジェクト。[/ja]
        */

       /**
        * @attribute modifier
        * @type {String}
        * @description
        *  [en]The appearance of the dialog.[/en]
        *  [ja]ダイアログの表現を指定します。[/ja]
        */

       /**
        * @attribute cancelable
        * @description
        *  [en]If this attribute is set the dialog can be closed by tapping the background or by pressing the back button.[/en]
        *  [ja]この属性があると、ダイアログが表示された時に、背景やバックボタンをタップした時にダイアログを閉じます。[/ja]
        */

       /**
        * @attribute disabled
        * @description
        *  [en]If this attribute is set the dialog is disabled.[/en]
        *  [ja]この属性がある時、ダイアログはdisabled状態になります。[/ja]
        */

       /**
        * @attribute animation
        * @type {String}
        * @default default
        * @description
        *  [en]The animation used when showing and hiding the dialog. Can be either "none" or "default".[/en]
        *  [ja]ダイアログを表示する際のアニメーション名を指定します。"none"もしくは"default"を指定できます。[/ja]
        */

       /**
        * @attribute animation-options
        * @type {Expression}
        * @description
        *  [en]Specify the animation's duration, timing and delay with an object literal. E.g. <code>{duration: 0.2, delay: 1, timing: 'ease-in'}</code>[/en]
        *  [ja]アニメーション時のduration, timing, delayをオブジェクトリテラルで指定します。e.g. <code>{duration: 0.2, delay: 1, timing: 'ease-in'}</code>[/ja]
        */

       /**
        * @attribute mask-color
        * @type {String}
        * @default rgba(0, 0, 0, 0.2)
        * @description
        *  [en]Color of the background mask. Default is "rgba(0, 0, 0, 0.2)".[/en]
        *  [ja]背景のマスクの色を指定します。"rgba(0, 0, 0, 0.2)"がデフォルト値です。[/ja]
        */

       /**
        * @return {Element}
        */
       get: function get() {
         return util.findChild(this, '.dialog-mask');
       }

       /**
        * @return {Element}
        */

     }, {
       key: '_dialog',
       get: function get() {
         return util.findChild(this, '.dialog');
       }
     }]);
     return DialogElement;
   })(BaseElement);

   var OnsDialogElement = window.OnsDialogElement = document.registerElement('ons-dialog', {
     prototype: DialogElement.prototype
   });

   /**
    * @param {String} name
    * @param {DialogAnimator} Animator
    */
   OnsDialogElement.registerAnimator = function (name, Animator) {
     if (!(Animator.prototype instanceof DialogAnimator)) {
       throw new Error('"Animator" param must inherit OnsDialogElement.DialogAnimator');
     }
     _animatorDict$1[name] = Animator;
   };

   OnsDialogElement.DialogAnimator = DialogAnimator;

   var scheme$5 = {
     '': 'fab--*'
   };

   /**
    * @element ons-fab
    * @category fab
    * @description
    *   [en][/en]
    *   [ja][/ja]
    */

   var FabElement = (function (_BaseElement) {
     babelHelpers.inherits(FabElement, _BaseElement);

     function FabElement() {
       babelHelpers.classCallCheck(this, FabElement);
       return babelHelpers.possibleConstructorReturn(this, Object.getPrototypeOf(FabElement).apply(this, arguments));
     }

     babelHelpers.createClass(FabElement, [{
       key: 'createdCallback',

       /**
        * @attribute modifier
        * @type {String}
        * @description
        *  [en]The appearance of the button.[/en]
        *  [ja]ボタンの表現を指定します。[/ja]
        */

       /**
        * @attribute position
        * @type {String}
        * @description
        *  [en][/en]
        *  [ja]fabコンポーネントを表示する位置を指定します。 上下位置と左右位置を指定します。 上下位置に指定できるのは`top`か`bottom`です。左右位置で指定できるのは`left`か`right`か`center`です。`top left`と指定すると、左上に表示されます。`bottom center`と指定すると、下部中央に表示されます。[/ja]
        */

       /**
        * @attribute inline
        * @description
        *  [en][/en]
        *  [ja]この属性が設定されると、このコンポーネントはposition属性を無視してインラインに表示されます。[/ja]
        */

       /**
        * @attribute disabled
        * @description
        *   [en]Specify if button should be disabled.[/en]
        *   [ja]ボタンを無効化する場合は指定します。[/ja]
        */

       value: function createdCallback() {
         if (!this.hasAttribute('_compiled')) {
           this._compile();
         }
       }
     }, {
       key: '_compile',
       value: function _compile() {
         ons._autoStyle.prepare(this);

         this.classList.add('fab');

         var content = document.createElement('span');
         content.classList.add('fab__icon');

         util.arrayFrom(this.childNodes).forEach(function (element) {
           return content.appendChild(element);
         });

         this.insertBefore(content, this.firstChild);

         if (this.hasAttribute('ripple') && !util.findChild(content, 'ons-ripple')) {
           content.insertBefore(document.createElement('ons-ripple'), content.firstChild);
         }

         ModifierUtil.initModifier(this, scheme$5);

         this._updatePosition();
         this.hide();

         this.setAttribute('_compiled', '');
       }
     }, {
       key: 'attributeChangedCallback',
       value: function attributeChangedCallback(name, last, current) {
         if (name === 'modifier') {
           return ModifierUtil.onModifierChanged(last, current, this, scheme$5);
         }
         if (name === 'position') {
           this._updatePosition();
         }
       }
     }, {
       key: '_show',
       value: function _show() {
         if (!this.isInline()) {
           this.show();
         }
       }
     }, {
       key: '_hide',
       value: function _hide() {
         if (!this.isInline()) {
           this.hide();
         }
       }
     }, {
       key: '_updatePosition',
       value: function _updatePosition() {
         var position = this.getAttribute('position');
         this.classList.remove('fab--top__left', 'fab--bottom__right', 'fab--bottom__left', 'fab--top__right', 'fab--top__center', 'fab--bottom__center');
         switch (position) {
           case 'top right':
           case 'right top':
             this.classList.add('fab--top__right');
             break;
           case 'top left':
           case 'left top':
             this.classList.add('fab--top__left');
             break;
           case 'bottom right':
           case 'right bottom':
             this.classList.add('fab--bottom__right');
             break;
           case 'bottom left':
           case 'left bottom':
             this.classList.add('fab--bottom__left');
             break;
           case 'center top':
           case 'top center':
             this.classList.add('fab--top__center');
             break;
           case 'center bottom':
           case 'bottom center':
             this.classList.add('fab--bottom__center');
             break;
           default:
             break;
         }
       }

       /**
        * @method show
        * @signature show()
        * @description
        *  [en][/en]
        *  [ja][/ja]
        */

     }, {
       key: 'show',
       value: function show() {
         var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

         this.style.transform = 'scale(1)';
         this.style.webkitTransform = 'scale(1)';
       }

       /**
        * @method hide
        * @signature hide()
        * @description
        *  [en][/en]
        *  [ja][/ja]
        */

     }, {
       key: 'hide',
       value: function hide() {
         var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

         this.style.transform = 'scale(0)';
         this.style.webkitTransform = 'scale(0)';
       }

       /**
        * @method setDisabled
        * @signature setDisabled(disabled)
        * @param {Boolean} disabled
        * @description
        *  [en]Disabled of enable fab.[/en]
        *  [ja][/ja]
        */

     }, {
       key: 'setDisabled',
       value: function setDisabled(disabled) {
         if (typeof disabled !== 'boolean') {
           throw new Error('Argument must be a boolean.');
         }

         if (disabled) {
           this.setAttribute('disabled', '');
         } else {
           this.removeAttribute('disabled');
         }
       }

       /**
        * @method isDisabled
        * @signature isDisabled()
        * @description
        *   [en]True if fab is disabled.[/en]
        *   [ja]disabled状態であるかどうかを返します。[/ja]
        * @return {Boolean}
        */

     }, {
       key: 'isDisabled',
       value: function isDisabled() {
         return this.hasAttribute('disabled');
       }

       /**
        * True if fab is inline element.
        *
        * @return {Boolean}
        */
       /**
        * @method isInline
        * @signature isInline()
        * @description
        *   [en]True if fab is inline.[/en]
        *   [ja]inline属性があるかどうかを返します。[/ja]
        * @return {Boolean}
        */

     }, {
       key: 'isInline',
       value: function isInline() {
         return this.hasAttribute('inline');
       }

       /**
        * @method isShown
        * @signature isShown()
        * @description
        *   [en]True if fab is shown.[/en]
        *   [ja]このコンポーネントが表示されているかどうかを返します。[/ja]
        * @return {Boolean}
        */

     }, {
       key: 'isShown',
       value: function isShown() {
         return this.style.transform === 'scale(1)' && this.style.display !== 'none';
       }

       /**
        * @method toggle
        * @signature toggle()
        * @description
        *   [en][/en]
        *   [ja][/ja]
        */

     }, {
       key: 'toggle',
       value: function toggle() {
         if (this.isShown()) {
           this.hide();
         } else {
           this.show();
         }
       }
     }]);
     return FabElement;
   })(BaseElement);

   window.OnsFabElement = document.registerElement('ons-fab', {
     prototype: FabElement.prototype
   });

   /**
    * @element ons-gesture-detector
    * @category input
    * @description
    *   [en]Component to detect finger gestures within the wrapped element. See the guide for more details.[/en]
    *   [ja]要素内のジェスチャー操作を検知します。詳しくはガイドを参照してください。[/ja]
    * @guide DetectingFingerGestures
    *   [en]Detecting finger gestures[/en]
    *   [ja]ジェスチャー操作の検知[/ja]
    * @example
    * <ons-gesture-detector style="height: 100%; width: 100%;">
    *   ...
    * </ons-gesture-detector>
    */

   var GestureDetectorElement = (function (_BaseElement) {
     babelHelpers.inherits(GestureDetectorElement, _BaseElement);

     function GestureDetectorElement() {
       babelHelpers.classCallCheck(this, GestureDetectorElement);
       return babelHelpers.possibleConstructorReturn(this, Object.getPrototypeOf(GestureDetectorElement).apply(this, arguments));
     }

     babelHelpers.createClass(GestureDetectorElement, [{
       key: 'createdCallback',
       value: function createdCallback() {
         this._gestureDetector = new GestureDetector(this);
       }
     }]);
     return GestureDetectorElement;
   })(BaseElement);

   window.OnsGestureDetectorElement = document.registerElement('ons-gesture-detector', {
     prototype: GestureDetectorElement.prototype
   });

   /**
    * @element ons-icon
    * @category icon
    * @description
    *   [en]Displays an icon. Font Awesome(https://fortawesome.github.io/Font-Awesome/) and Ionicon icons(http://ionicons.com) and Material Design Iconic Font(http://zavoloklom.github.io/material-design-iconic-font/) are supported.[/en]
    *   [ja]アイコンを表示するコンポーネントです。Font Awesome(https://fortawesome.github.io/Font-Awesome/)もしくはIonicons(http://ionicons.com)もしくはMaterial Design Iconic Font(http://zavoloklom.github.io/material-design-iconic-font/)から選択できます。[/ja]
    * @codepen xAhvg
    * @guide UsingIcons [en]Using icons[/en][ja]アイコンを使う[/ja]
    * @example
    * <ons-icon
    *   icon="md-car"
    *   size="20px"
    *   fixed-width="false"
    *   style="color: red">
    * </ons-icon>
    */

   var IconElement = (function (_BaseElement) {
     babelHelpers.inherits(IconElement, _BaseElement);

     function IconElement() {
       babelHelpers.classCallCheck(this, IconElement);
       return babelHelpers.possibleConstructorReturn(this, Object.getPrototypeOf(IconElement).apply(this, arguments));
     }

     babelHelpers.createClass(IconElement, [{
       key: 'createdCallback',

       /**
        * @attribute icon
        * @type {String}
        * @description
        *   [en]The icon name. "md-" prefix for Material Icons, "fa-" for Font Awesome and "ion-" prefix for Ionicons icons. See all icons at http://zavoloklom.github.io/material-design-iconic-font/icons.html, http://fontawesome.io/icons/ and http://ionicons.com.[/en]
        *   [ja]アイコン名を指定します。<code>md-</code>で始まるものはMaterial Iconsとして、<code>fa-</code>で始まるものはFont Awesomeとして、<code>ion-</code>で始まるものはIoniconsとして扱われます。使用できるアイコンはこちら: http://zavoloklom.github.io/material-design-iconic-font/icons.html http://fontawesome.io/icons/ http://ionicons.com[/ja]
        */

       /**
        * @attribute size
        * @type {String}
        * @description
        *   [en]The sizes of the icon. Valid values are lg, 2x, 3x, 4x, 5x, or in pixels.[/en]
        *   [ja]アイコンのサイズを指定します。値は、lg, 2x, 3x, 4x, 5xもしくはピクセル単位で指定できます。[/ja]
        */

       /**
        * @attribute rotate
        * @type {Number}
        * @description
        *   [en]Number of degrees to rotate the icon. Valid values are 90, 180, or 270.[/en]
        *   [ja]アイコンを回転して表示します。90, 180, 270から指定できます。[/ja]
        */

       /**
        * @attribute flip
        * @type {String}
        * @description
        *   [en]Flip the icon. Valid values are "horizontal" and "vertical".[/en]
        *   [ja]アイコンを反転します。horizontalもしくはverticalを指定できます。[/ja]
        */

       /**
        * @attribute fixed-width
        * @type {Boolean}
        * @default false
        * @description
        *  [en]When used in the list, you want the icons to have the same width so that they align vertically by setting the value to true. Valid values are true, false. Default is false.[/en]
        *  [ja]等幅にするかどうかを指定します。trueもしくはfalseを指定できます。デフォルトはfalseです。[/ja]
        */

       /**
        * @attribute spin
        * @type {Boolean}
        * @default false
        * @description
        *   [en]Specify whether the icon should be spinning. Valid values are true and false.[/en]
        *   [ja]アイコンを回転するかどうかを指定します。trueもしくはfalseを指定できます。[/ja]
        */

       value: function createdCallback() {
         this._update();
       }
     }, {
       key: 'attributeChangedCallback',
       value: function attributeChangedCallback(name, last, current) {
         if (['icon', 'size'].indexOf(name) !== -1) {
           this._update();
         }
       }
     }, {
       key: '_update',
       value: function _update() {
         var _this2 = this;

         this._cleanClassAttribute();

         var builded = this._buildClassAndStyle(this);

         for (var key in builded.style) {
           if (builded.style.hasOwnProperty(key)) {
             this.style[key] = builded.style[key];
           }
         }

         builded.classList.forEach(function (className) {
           return _this2.classList.add(className);
         });
       }
     }, {
       key: '_cleanClassAttribute',

       /**
        * Remove unneeded class value.
        */
       value: function _cleanClassAttribute() {
         var classList = this.classList;

         Array.apply(null, this.classList).filter(function (klass) {
           return klass === 'fa' || klass.indexOf('fa-') === 0 || klass.indexOf('ion-') === 0 || klass.indexOf('zmdi-') === 0;
         }).forEach(function (className) {
           classList.remove(className);
         });

         classList.remove('zmdi');
         classList.remove('ons-icon--ion');
       }
     }, {
       key: '_buildClassAndStyle',
       value: function _buildClassAndStyle() {
         var classList = ['ons-icon'];
         var style = {};

         // icon
         var iconName = this._iconName;
         if (iconName.indexOf('ion-') === 0) {
           classList.push(iconName);
           classList.push('ons-icon--ion');
         } else if (iconName.indexOf('fa-') === 0) {
           classList.push(iconName);
           classList.push('fa');
         } else if (iconName.indexOf('md-') === 0) {
           classList.push('zmdi');
           classList.push('zmdi-' + iconName.split(/\-(.+)?/)[1]);
         } else {
           classList.push('fa');
           classList.push('fa-' + iconName);
         }

         // size
         var size = '' + this.getAttribute('size');
         if (size.match(/^[1-5]x|lg$/)) {
           classList.push('fa-' + size);
           this.style.removeProperty('font-size');
         } else {
           style.fontSize = size;
         }

         return {
           classList: classList,
           style: style
         };
       }
     }, {
       key: '_iconName',
       get: function get() {
         return '' + this.getAttribute('icon');
       }
     }]);
     return IconElement;
   })(BaseElement);

   window.OnsIconElement = document.registerElement('ons-icon', {
     prototype: IconElement.prototype
   });

   var InternalDelegate = (function (_LazyRepeatDelegate) {
     babelHelpers.inherits(InternalDelegate, _LazyRepeatDelegate);

     /**
      * @param {Object} userDelegate
      * @param {Element/null} [templateElement]
      */

     function InternalDelegate(userDelegate) {
       var templateElement = arguments.length <= 1 || arguments[1] === undefined ? null : arguments[1];
       babelHelpers.classCallCheck(this, InternalDelegate);

       var _this = babelHelpers.possibleConstructorReturn(this, Object.getPrototypeOf(InternalDelegate).call(this));

       _this._userDelegate = userDelegate;

       if (templateElement instanceof Element || templateElement === null) {
         _this._templateElement = templateElement;
       } else {
         throw new Error('templateElement parameter must be an instance of Element or null.');
       }
       return _this;
     }

     babelHelpers.createClass(InternalDelegate, [{
       key: 'prepareItem',
       value: function prepareItem(index, done) {
         var content = this._userDelegate.createItemContent(index, this._templateElement);

         if (!(content instanceof Element)) {
           throw new Error('createItemContent() must return an instance of Element.');
         }

         done({
           element: content
         });
       }
     }, {
       key: 'countItems',
       value: function countItems() {
         var count = this._userDelegate.countItems();

         if (typeof count !== 'number') {
           throw new Error('countItems() must return number.');
         }

         return count;
       }
     }, {
       key: 'updateItem',
       value: function updateItem(index, item) {
         if (this._userDelegate.updateItemContent instanceof Function) {
           this._userDelegate.updateItemContent(index, item);
         }
       }
     }, {
       key: 'calculateItemHeight',
       value: function calculateItemHeight(index) {
         var height = this._userDelegate.calculateItemHeight(index);

         if (typeof height !== 'number') {
           throw new Error('calculateItemHeight() must return number.');
         }

         return height;
       }
     }, {
       key: 'destroyItem',
       value: function destroyItem(index, item) {
         if (this._userDelegate.destroyItem instanceof Function) {
           this._userDelegate.destroyItem(index, item);
         }
       }
     }, {
       key: 'destroy',
       value: function destroy() {
         if (this._userDelegate.destroy instanceof Function) {
           this._userDelegate.destroy();
         }
       }
     }]);
     return InternalDelegate;
   })(LazyRepeatDelegate);

   /**
    * @element ons-lazy-repeat
    * @category control
    * @description
    *   [en]
    *     Using this component a list with millions of items can be rendered without a drop in performance.
    *     It does that by "lazily" loading elements into the DOM when they come into view and
    *     removing items from the DOM when they are not visible.
    *   [/en]
    *   [ja]
    *     このコンポーネント内で描画されるアイテムのDOM要素の読み込みは、画面に見えそうになった時まで自動的に遅延され、
    *     画面から見えなくなった場合にはその要素は動的にアンロードされます。
    *     このコンポーネントを使うことで、パフォーマンスを劣化させること無しに巨大な数の要素を描画できます。
    *   [/ja]
    * @codepen QwrGBm
    * @guide UsingLazyRepeat
    *   [en]How to use Lazy Repeat[/en]
    *   [ja]レイジーリピートの使い方[/ja]
    * @example
    * <script>
    *   window.addEventListener('load', function() {
    *     var lazyRepeat = document.querySelector('#list');
    *     lazyRepeat.delegate = {
    *      calculateItemHeight: function(i) {
    *        return 44;
    *      },
    *      createItemContent: function(i, template) {
    *        var dom = template.cloneNode(true);
    *        dom.innerText = i;
    *
    *        return dom;
    *      },
    *      countItems: function() {
    *         // Return number of items.
    *        return 10000000;
    *      },
    *      destroyItem: function(index, item) {
    *        // Optional method that is called when an item is unloaded.
    *        console.log('Destroyed item with index: ' + index);
    *      }
    *     };
    *   });
    * </script>
    *
    * <ons-list>
    *   <ons-lazy-repeat>
    *     <ons-list-item></ons-list-item>
    *   </ons-lazy-repeat>
    * </ons-list>
    */

   var LazyRepeatElement = (function (_BaseElement) {
     babelHelpers.inherits(LazyRepeatElement, _BaseElement);

     function LazyRepeatElement() {
       babelHelpers.classCallCheck(this, LazyRepeatElement);
       return babelHelpers.possibleConstructorReturn(this, Object.getPrototypeOf(LazyRepeatElement).apply(this, arguments));
     }

     babelHelpers.createClass(LazyRepeatElement, [{
       key: 'createdCallback',
       value: function createdCallback() {
         this.style.display = 'none';
       }
     }, {
       key: 'attributeChangedCallback',
       value: function attributeChangedCallback(name, last, current) {}
     }, {
       key: 'attachedCallback',
       value: function attachedCallback() {
         if (!this._parentUpdated && this.parentElement) {
           if (window.getComputedStyle(this.parentElement).getPropertyValue('position') === 'static') {
             this.parentElement.style.position = 'relative';
           }
           this._parentUpdated = true;
         }
         if (this.hasAttribute('delegate')) {
           this.setDelegate(this._getUserDelegate());
         }
       }
     }, {
       key: '_getTemplateElement',
       value: function _getTemplateElement() {
         if (this.children[0] && !this._templateElement) {
           this._templateElement = this.removeChild(this.children[0]);
         }

         return this._templateElement || null;
       }
     }, {
       key: '_getUserDelegate',
       value: function _getUserDelegate() {
         var name = this.getAttribute('delegate') || this.getAttribute('ons-lazy-repeat');

         return window[name] || null;
       }
     }, {
       key: 'detachedCallback',
       value: function detachedCallback() {
         if (this._lazyRepeatProvider) {
           this._lazyRepeatProvider.destroy();
           this._lazyRepeatProvider = null;
         }
       }

       /**
        * @method refresh
        * @signature refresh()
        * @description
        *   [en][/en]
        *   [ja][/ja]
        */

     }, {
       key: 'refresh',
       value: function refresh() {
         if (this._lazyRepeatProvider) {
           this._lazyRepeatProvider.refresh();
         }
       }

       /**
        * @method setDelegate
        * @signature setDelegate(userDelegate)
        * @param {Object} userDelegate
        * @description
        *  [en]Specify a delegate object to load and unload item elements.[/en]
        *  [ja]要素のロード、アンロードなどの処理を委譲するオブジェクトを指定します。[/ja]
        */

     }, {
       key: 'setDelegate',
       value: function setDelegate(userDelegate) {
         if (this._lazyRepeatProvider) {
           this._lazyRepeatProvider.destroy();
         }

         var delegate = new InternalDelegate(userDelegate, this._getTemplateElement());
         this._lazyRepeatProvider = new LazyRepeatProvider(this.parentElement, delegate);
       }

       /**
        * @property delegate
        * @description
        *  [en]Specify a delegate object to load and unload item elements.[/en]
        *  [ja]要素のロード、アンロードなどの処理を委譲するオブジェクトを指定します。[/ja]
        */

     }, {
       key: 'delegate',
       set: function set(userDelegate) {
         this.setDelegate(userDelegate);
       }
     }]);
     return LazyRepeatElement;
   })(BaseElement);

   window.OnsLazyRepeatElement = document.registerElement('ons-lazy-repeat', {
     prototype: LazyRepeatElement.prototype
   });

   var scheme$6 = { '': 'list__header--*' };

   /**
    * @element ons-list-header
    * @category list
    * @description
    *   [en]Header element for list items. Must be put inside ons-list component.[/en]
    *   [ja]リスト要素に使用するヘッダー用コンポーネント。ons-listと共に使用します。[/ja]
    * @seealso ons-list
    *   [en]ons-list component[/en]
    *   [ja]ons-listコンポーネント[/ja]
    * @seealso ons-list-item [en]ons-list-item component[/en][ja]ons-list-itemコンポーネント[/ja]
    * @guide UsingList [en]Using lists[/en][ja]リストを使う[/ja]
    * @codepen yxcCt
    * @example
    * <ons-list>
    *   <ons-list-header>Header Text</ons-list-header>
    *   <ons-list-item>Item</ons-list-item>
    *   <ons-list-item>Item</ons-list-item>
    * </ons-list>
    */

   var ListHeaderElement = (function (_BaseElement) {
     babelHelpers.inherits(ListHeaderElement, _BaseElement);

     function ListHeaderElement() {
       babelHelpers.classCallCheck(this, ListHeaderElement);
       return babelHelpers.possibleConstructorReturn(this, Object.getPrototypeOf(ListHeaderElement).apply(this, arguments));
     }

     babelHelpers.createClass(ListHeaderElement, [{
       key: 'createdCallback',

       /**
        * @attribute modifier
        * @type {String}
        * @description
        *   [en]The appearance of the list header.[/en]
        *   [ja]ヘッダーの表現を指定します。[/ja]
        */

       value: function createdCallback() {
         if (!this.hasAttribute('_compiled')) {
           this._compile();
         }
       }
     }, {
       key: '_compile',
       value: function _compile() {
         ons._autoStyle.prepare(this);

         this.classList.add('list__header');
         ModifierUtil.initModifier(this, scheme$6);

         this.setAttribute('_compiled', '');
       }
     }, {
       key: 'attributeChangedCallback',
       value: function attributeChangedCallback(name, last, current) {
         if (name === 'modifier') {
           return ModifierUtil.onModifierChanged(last, current, this, scheme$6);
         }
       }
     }]);
     return ListHeaderElement;
   })(BaseElement);

   window.OnsListHeaderElement = document.registerElement('ons-list-header', {
     prototype: ListHeaderElement.prototype
   });

   var scheme$8 = {
     '.list__item': 'list__item--*',
     '.list__item__left': 'list__item--*__left',
     '.list__item__center': 'list__item--*__center',
     '.list__item__right': 'list__item--*__right',
     '.list__item__label': 'list__item--*__label',
     '.list__item__title': 'list__item--*__title',
     '.list__item__subtitle': 'list__item--*__subtitle',
     '.list__item__thumbnail': 'list__item--*__thumbnail',
     '.list__item__icon': 'list__item--*__icon'
   };

   /**
    * @element ons-list-item
    * @category list
    * @modifier tight
    *   [en]Remove the space above and below the item content. This is useful for multi-line content.[/en]
    *   [ja]行間のスペースを取り除きます。複数行の内容をリストで扱う場合に便利です。[/ja]
    * @modifier tappable
    *   [en]Make the list item change appearance when it's tapped. On iOS it is better to use the "tappable" attribute for better behavior when scrolling.[/en]
    *   [ja]タップやクリックした時に効果が表示されるようになります。[/ja]
    * @modifier chevron
    *   [en]Display a chevron at the right end of the list item and make it change appearance when tapped.[/en]
    *   [ja]要素の右側に右矢印が表示されます。また、タップやクリックした時に効果が表示されるようになります。[/ja]
    * @description
    *   [en]Component that represents each item in the list. Must be put inside the ons-list component.[/en]
    *   [ja]リストの各要素を表現するためのコンポーネントです。ons-listコンポーネントと共に使用します。[/ja]
    * @seealso ons-list
    *   [en]ons-list component[/en]
    *   [ja]ons-listコンポーネント[/ja]
    * @seealso ons-list-header
    *   [en]ons-list-header component[/en]
    *   [ja]ons-list-headerコンポーネント[/ja]
    * @guide UsingList
    *   [en]Using lists[/en]
    *   [ja]リストを使う[/ja]
    * @codepen yxcCt
    * @example
    * <ons-list>
    *   <ons-list-header>Header Text</ons-list-header>
    *   <ons-list-item>Item</ons-list-item>
    *   <ons-list-item>Item</ons-list-item>
    * </ons-list>
    */

   var ListItemElement = (function (_BaseElement) {
     babelHelpers.inherits(ListItemElement, _BaseElement);

     function ListItemElement() {
       babelHelpers.classCallCheck(this, ListItemElement);
       return babelHelpers.possibleConstructorReturn(this, Object.getPrototypeOf(ListItemElement).apply(this, arguments));
     }

     babelHelpers.createClass(ListItemElement, [{
       key: 'createdCallback',

       /**
        * @attribute modifier
        * @type {String}
        * @description
        *   [en]The appearance of the list item.[/en]
        *   [ja]各要素の表現を指定します。[/ja]
        */

       /**
        * @attribute lock-on-drag
        * @type {String}
        * @description
        *   [en]Prevent vertical scrolling when the user drags horizontally.[/en]
        *   [ja]この属性があると、ユーザーがこの要素を横方向にドラッグしている時に、縦方向のスクロールが起きないようになります。[/ja]
        */

       /**
        * @attribute tappable
        * @type {Color}
        * @description
        *   [en]Changes the background color when tapped. An optional color value can be defined. Default color is "#d9d9d9".[/en]
        *   [ja][/ja]
        */

       value: function createdCallback() {
         if (!this.hasAttribute('_compiled')) {
           this._compile();
         }
       }
     }, {
       key: '_compile',
       value: function _compile() {
         ons._autoStyle.prepare(this);
         this.classList.add('list__item');

         var left = undefined,
             center = undefined,
             right = undefined;

         for (var i = 0; i < this.children.length; i++) {
           var el = this.children[i];

           if (el.classList.contains('left')) {
             el.classList.add('list__item__left');
             left = el;
           } else if (el.classList.contains('center')) {
             center = el;
           } else if (el.classList.contains('right')) {
             el.classList.add('list__item__right');
             right = el;
           }
         }

         if (!center) {
           center = document.createElement('div');

           if (!left && !right) {
             center.innerHTML = this.innerHTML;
             this.innerHTML = '';
           } else {

             for (var i = this.childNodes.length - 1; i >= 0; i--) {
               var el = this.childNodes[i];
               if (el !== left && el !== right) {
                 center.insertBefore(el, center.firstChild);
               }
             }
           }

           this.insertBefore(center, right || null);
         }

         center.classList.add('center');
         center.classList.add('list__item__center');

         if (this.hasAttribute('ripple')) {
           this.insertBefore(document.createElement('ons-ripple'), this.firstChild);
         }

         ModifierUtil.initModifier(this, scheme$8);

         this.setAttribute('_compiled', '');
       }
     }, {
       key: 'attributeChangedCallback',
       value: function attributeChangedCallback(name, last, current) {
         if (name === 'modifier') {
           return ModifierUtil.onModifierChanged(last, current, this, scheme$8);
         }
       }
     }, {
       key: 'attachedCallback',
       value: function attachedCallback() {
         this.addEventListener('drag', this._onDrag);
         this.addEventListener('touchstart', this._onTouch);
         this.addEventListener('mousedown', this._onTouch);
         this.addEventListener('touchend', this._onRelease);
         this.addEventListener('touchmove', this._onRelease);
         this.addEventListener('touchcancel', this._onRelease);
         this.addEventListener('mouseup', this._onRelease);
         this.addEventListener('mouseout', this._onRelease);
         this.addEventListener('touchleave', this._onRelease);

         this._originalBackgroundColor = this.style.backgroundColor;

         this.tapped = false;
       }
     }, {
       key: 'detachedCallback',
       value: function detachedCallback() {
         this.removeEventListener('drag', this._onDrag);
         this.removeEventListener('touchstart', this._onTouch);
         this.removeEventListener('mousedown', this._onTouch);
         this.removeEventListener('touchend', this._onRelease);
         this.removeEventListener('touchmove', this._onRelease);
         this.removeEventListener('touchcancel', this._onRelease);
         this.removeEventListener('mouseup', this._onRelease);
         this.removeEventListener('mouseout', this._onRelease);
         this.removeEventListener('touchleave', this._onRelease);
       }
     }, {
       key: '_onDrag',
       value: function _onDrag(event) {
         var gesture = event.gesture;
         // Prevent vertical scrolling if the users pans left or right.
         if (this._shouldLockOnDrag() && ['left', 'right'].indexOf(gesture.direction) > -1) {
           gesture.preventDefault();
         }
       }
     }, {
       key: '_onTouch',
       value: function _onTouch() {
         if (this.tapped) {
           return;
         }

         this.tapped = true;

         this.style.transition = this._transition;
         this.style.webkitTransition = this._transition;
         this.style.MozTransition = this._transition;

         if (this._tappable) {
           if (this.style.backgroundColor) {
             this._originalBackgroundColor = this.style.backgroundColor;
           }

           this.style.backgroundColor = this._tapColor;
         }
       }
     }, {
       key: '_onRelease',
       value: function _onRelease() {
         this.tapped = false;

         this.style.transition = '';
         this.style.webkitTransition = '';
         this.style.MozTransition = '';

         this.style.backgroundColor = this._originalBackgroundColor || '';
       }
     }, {
       key: '_shouldLockOnDrag',
       value: function _shouldLockOnDrag() {
         return this.hasAttribute('lock-on-drag');
       }
     }, {
       key: '_transition',
       get: function get() {
         return 'background-color 0.0s linear 0.02s';
       }
     }, {
       key: '_tappable',
       get: function get() {
         return this.hasAttribute('tappable');
       }
     }, {
       key: '_tapColor',
       get: function get() {
         return this.getAttribute('tappable') || '#d9d9d9';
       }
     }]);
     return ListItemElement;
   })(BaseElement);

   window.OnsListItemElement = document.registerElement('ons-list-item', {
     prototype: ListItemElement.prototype
   });

   var scheme$9 = { '': 'list--*' };

   /**
    * @element ons-list
    * @category list
    * @modifier inset
    *   [en]Inset list that doesn't cover the whole width of the parent.[/en]
    *   [ja]親要素の画面いっぱいに広がらないリストを表示します。[/ja]
    * @modifier noborder
    *   [en]A list with no borders at the top and bottom.[/en]
    *   [ja]リストの上下のボーダーが無いリストを表示します。[/ja]
    * @description
    *   [en]Component to define a list, and the container for ons-list-item(s).[/en]
    *   [ja]リストを表現するためのコンポーネント。ons-list-itemのコンテナとして使用します。[/ja]
    * @seealso ons-list-item
    *   [en]ons-list-item component[/en]
    *   [ja]ons-list-itemコンポーネント[/ja]
    * @seealso ons-list-header
    *   [en]ons-list-header component[/en]
    *   [ja]ons-list-headerコンポーネント[/ja]
    * @guide UsingList
    *   [en]Using lists[/en]
    *   [ja]リストを使う[/ja]
    * @codepen yxcCt
    * @example
    * <ons-list>
    *   <ons-list-header>Header Text</ons-list-header>
    *   <ons-list-item>Item</ons-list-item>
    *   <ons-list-item>Item</ons-list-item>
    * </ons-list>
    */

   var ListElement = (function (_BaseElement) {
     babelHelpers.inherits(ListElement, _BaseElement);

     function ListElement() {
       babelHelpers.classCallCheck(this, ListElement);
       return babelHelpers.possibleConstructorReturn(this, Object.getPrototypeOf(ListElement).apply(this, arguments));
     }

     babelHelpers.createClass(ListElement, [{
       key: 'createdCallback',

       /**
        * @attribute modifier
        * @type {String}
        * @description
        *   [en]The appearance of the list.[/en]
        *   [ja]リストの表現を指定します。[/ja]
        */

       value: function createdCallback() {
         if (!this.hasAttribute('_compiled')) {
           this._compile();
         }
       }
     }, {
       key: '_compile',
       value: function _compile() {
         ons._autoStyle.prepare(this);

         this.classList.add('list');
         ModifierUtil.initModifier(this, scheme$9);

         this.setAttribute('_compiled', '');
       }
     }, {
       key: 'attributeChangedCallback',
       value: function attributeChangedCallback(name, last, current) {
         if (name === 'modifier') {
           return ModifierUtil.onModifierChanged(last, current, this, scheme$9);
         }
       }
     }]);
     return ListElement;
   })(BaseElement);

   window.OnsListElement = document.registerElement('ons-list', {
     prototype: ListElement.prototype
   });

   var scheme$7 = {
     '.text-input': 'text-input--*',
     '.text-input__label': 'text-input--*__label',
     '.radio-button': 'radio-button--*',
     '.radio-button__input': 'radio-button--*__input',
     '.radio-button__checkmark': 'radio-button--*__checkmark',
     '.checkbox': 'checkbox--*',
     '.checkbox__input': 'checkbox--*__input',
     '.checkbox__checkmark': 'checkbox--*__checkmark'
   };

   var INPUT_ATTRIBUTES = ['autocapitalize', 'autocomplete', 'autocorrect', 'autofocus', 'checked', 'disabled', 'inputmode', 'max', 'maxlength', 'min', 'minlength', 'name', 'pattern', 'placeholder', 'readonly', 'size', 'step', 'type', 'validator', 'value'];

   /**
    * @element ons-material-input
    * @category form
    * @description
    *  [en]Material Design input component.[/en]
    *  [ja]Material Designのinputコンポ―ネントです。[/ja]
    * @codepen ojQxLj
    * @guide UsingFormComponents
    *   [en]Using form components[/en]
    *   [ja]フォームを使う[/ja]
    * @guide EventHandling
    *   [en]Event handling descriptions[/en]
    *   [ja]イベント処理の使い方[/ja]
    * @example
    * <ons-material-input label="Username"></ons-material-input>
    */

   var MaterialInputElement = (function (_BaseElement) {
     babelHelpers.inherits(MaterialInputElement, _BaseElement);

     function MaterialInputElement() {
       babelHelpers.classCallCheck(this, MaterialInputElement);
       return babelHelpers.possibleConstructorReturn(this, Object.getPrototypeOf(MaterialInputElement).apply(this, arguments));
     }

     babelHelpers.createClass(MaterialInputElement, [{
       key: 'createdCallback',

       /**
        * @attribute label
        * @type {String}
        * @description
        *   [en]Text for animated floating label.[/en]
        *   [ja]アニメーションさせるフローティングラベルのテキストを指定します。[/ja]
        */

       /**
        * @attribute no-float
        * @description
        *  [en]If this attribute is present, the label will not be animated.[/en]
        *  [ja]この属性が設定された時、ラベルはアニメーションしないようになります。[/ja]
        */

       value: function createdCallback() {
         if (!this.hasAttribute('_compiled')) {
           this._compile();
         }
       }
     }, {
       key: '_compile',
       value: function _compile() {
         ons._autoStyle.prepare(this);

         var helper = document.createElement('span');
         helper.classList.add('_helper');

         var container = document.createElement('label');
         container.appendChild(document.createElement('input'));
         container.appendChild(helper);

         var label = document.createElement('span');
         label.classList.add('input-label');

         ons._util.arrayFrom(this.childNodes).forEach(function (element) {
           return label.appendChild(element);
         });
         this.hasAttribute('content-left') ? container.insertBefore(label, container.firstChild) : container.appendChild(label);

         this.appendChild(container);

         switch (this.getAttribute('type')) {
           case 'checkbox':
             this.classList.add('checkbox');
             this._input.classList.add('checkbox__input');
             this._helper.classList.add('checkbox__checkmark');
             this._updateBoundAttributes();
             break;

           case 'radio':
             this.classList.add('radio-button');
             this._input.classList.add('radio-button__input');
             this._helper.classList.add('radio-button__checkmark');
             this._updateBoundAttributes();
             break;

           default:
             this._input.classList.add('text-input');
             this._helper.classList.add('text-input__label');
             this._input.parentElement.classList.add('text-input__container');

             this._updateLabel();
             this._updateLabelColor();
             this._updateBoundAttributes();
             this._updateLabelClass();

             this._boundOnInput = this._onInput.bind(this);
             this._boundOnFocusin = this._onFocusin.bind(this);
             this._boundOnFocusout = this._onFocusout.bind(this);
             break;
         }

         this._boundDelegateEvent = this._delegateEvent.bind(this);

         if (this.hasAttribute('input-id')) {
           this._input.id = this.getAttribute('input-id');
         }

         ModifierUtil.initModifier(this, scheme$7);

         this.setAttribute('_compiled', '');
       }
     }, {
       key: 'attributeChangedCallback',
       value: function attributeChangedCallback(name, last, current) {
         if (name === 'modifier') {
           return ModifierUtil.onModifierChanged(last, current, this, scheme$7);
         } else if (name === 'placeholder') {
           return this._updateLabel();
         }if (name === 'input-id') {
           this._input.id = current;
         } else if (INPUT_ATTRIBUTES.indexOf(name) >= 0) {
           return this._updateBoundAttributes();
         }
       }
     }, {
       key: 'attachedCallback',
       value: function attachedCallback() {
         if (this._input.type !== 'checkbox' && this._input.type !== 'radio') {
           this._input.addEventListener('input', this._boundOnInput);
           this._input.addEventListener('focusin', this._boundOnFocusin);
           this._input.addEventListener('focusout', this._boundOnFocusout);
         }

         this._input.addEventListener('focus', this._boundDelegateEvent);
         this._input.addEventListener('blur', this._boundDelegateEvent);
       }
     }, {
       key: 'detachedCallback',
       value: function detachedCallback() {
         this._input.removeEventListener('input', this._boundOnInput);
         this._input.removeEventListener('focusin', this._boundOnFocusin);
         this._input.removeEventListener('focusout', this._boundOnFocusout);
         this._input.removeEventListener('focus', this._boundDelegateEvent);
         this._input.removeEventListener('blur', this._boundDelegateEvent);
       }
     }, {
       key: '_setLabel',
       value: function _setLabel(value) {
         if (typeof this._helper.textContent !== 'undefined') {
           this._helper.textContent = value;
         } else {
           this._helper.innerText = value;
         }
       }
     }, {
       key: '_updateLabel',
       value: function _updateLabel() {
         this._setLabel(this.hasAttribute('placeholder') ? this.getAttribute('placeholder') : '');
       }
     }, {
       key: '_updateBoundAttributes',
       value: function _updateBoundAttributes() {
         var _this2 = this;

         INPUT_ATTRIBUTES.forEach(function (attr) {
           if (_this2.hasAttribute(attr)) {
             _this2._input.setAttribute(attr, _this2.getAttribute(attr));
           } else {
             _this2._input.removeAttribute(attr);
           }
         });
       }
     }, {
       key: '_updateLabelColor',
       value: function _updateLabelColor() {
         if (this.value.length > 0 && this._input === document.activeElement) {
           this._helper.style.color = '';
         } else {
           this._helper.style.color = 'rgba(0, 0, 0, 0.5)';
         }
       }
     }, {
       key: '_updateLabelClass',
       value: function _updateLabelClass() {
         if (this.value === '') {
           this._helper.classList.remove('text-input__label--active');
         } else {
           this._helper.classList.add('text-input__label--active');
         }
       }
     }, {
       key: '_delegateEvent',
       value: function _delegateEvent(event) {
         var e = new CustomEvent(event.type, {
           bubbles: false,
           cancelable: true
         });

         return this.dispatchEvent(e);
       }
     }, {
       key: '_onInput',
       value: function _onInput(event) {
         this._updateLabelClass();
         this._updateLabelColor();
       }
     }, {
       key: '_onFocusin',
       value: function _onFocusin(event) {
         this._updateLabelClass();
         this._updateLabelColor();
       }
     }, {
       key: '_onFocusout',
       value: function _onFocusout(event) {
         this._updateLabelColor();
       }
     }, {
       key: '_input',
       get: function get() {
         return this.querySelector('input');
       }
     }, {
       key: '_helper',
       get: function get() {
         return this.querySelector('._helper');
       }
     }, {
       key: 'value',
       get: function get() {
         return this._input.value;
       },
       set: function set(val) {
         this._input.value = val;
         this._onInput();

         return this._input.val;
       }
     }, {
       key: 'checked',
       get: function get() {
         return this._input.checked;
       },
       set: function set(val) {
         this._input.checked = val;
       }
     }, {
       key: '_isTextInput',
       get: function get() {
         return this._input.classList.contains('text-input');
       }
     }]);
     return MaterialInputElement;
   })(BaseElement);

   window.OnsInputElement = document.registerElement('ons-input', {
     prototype: MaterialInputElement.prototype
   });

   /*
   Copyright 2013-2015 ASIAL CORPORATION

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.

   */

   var ModalAnimator = (function () {

     /**
      * @param {Object} options
      * @param {String} options.timing
      * @param {Number} options.duration
      * @param {Number} options.delay
      */

     function ModalAnimator() {
       var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];
       babelHelpers.classCallCheck(this, ModalAnimator);

       this.delay = 0;
       this.duration = 0.2;

       this.timing = options.timing || this.timing;
       this.duration = options.duration !== undefined ? options.duration : this.duration;
       this.delay = options.delay !== undefined ? options.delay : this.delay;
     }

     /**
      * @param {HTMLElement} modal
      * @param {Function} callback
      */

     babelHelpers.createClass(ModalAnimator, [{
       key: "show",
       value: function show(modal, callback) {
         callback();
       }

       /**
        * @param {HTMLElement} modal
        * @param {Function} callback
        */

     }, {
       key: "hide",
       value: function hide(modal, callback) {
         callback();
       }
     }]);
     return ModalAnimator;
   })();

   /**
    * iOS style animator for dialog.
    */

   var FadeModalAnimator = (function (_ModalAnimator) {
     babelHelpers.inherits(FadeModalAnimator, _ModalAnimator);

     function FadeModalAnimator(options) {
       babelHelpers.classCallCheck(this, FadeModalAnimator);

       options.timing = options.timing || 'linear';
       options.duration = options.duration || '0.3';
       options.delay = options.delay || 0;

       return babelHelpers.possibleConstructorReturn(this, Object.getPrototypeOf(FadeModalAnimator).call(this, options));
     }

     /**
      * @param {HTMLElement} modal
      * @param {Function} callback
      */

     babelHelpers.createClass(FadeModalAnimator, [{
       key: 'show',
       value: function show(modal, callback) {
         callback = callback ? callback : function () {};

         animit(modal).queue({
           opacity: 0
         }).wait(this.delay).queue({
           opacity: 1.0
         }, {
           duration: this.duration,
           timing: this.timing
         }).queue(function (done) {
           callback();
           done();
         }).play();
       }

       /**
        * @param {HTMLElement} modal
        * @param {Function} callback
        */

     }, {
       key: 'hide',
       value: function hide(modal, callback) {
         callback = callback ? callback : function () {};

         animit(modal).queue({
           opacity: 1
         }).wait(this.delay).queue({
           opacity: 0
         }, {
           duration: this.duration,
           timing: this.timing
         }).queue(function (done) {
           callback();
           done();
         }).play();
       }
     }]);
     return FadeModalAnimator;
   })(ModalAnimator);

   var scheme$22 = {
     '': 'modal--*',
     'modal__content': 'modal--*__content'
   };

   var _animatorDict$3 = {
     'default': ModalAnimator,
     'fade': FadeModalAnimator,
     'none': ModalAnimator
   };

   /**
    * @element ons-modal
    * @category modal
    * @description
    *   [en]
    *     Modal component that masks current screen.
    *     Underlying components are not subject to any events while the modal component is shown.
    *   [/en]
    *   [ja]
    *     画面全体をマスクするモーダル用コンポーネントです。下側にあるコンポーネントは、
    *     モーダルが表示されている間はイベント通知が行われません。
    *   [/ja]
    * @guide UsingModal
    *   [en]Using ons-modal component[/en]
    *   [ja]モーダルの使い方[/ja]
    * @guide CallingComponentAPIsfromJavaScript
    *   [en]Using navigator from JavaScript[/en]
    *   [ja]JavaScriptからコンポーネントを呼び出す[/ja]
    * @codepen devIg
    * @example
    * <ons-modal>
    *   ...
    * </ons-modal>
    */

   var ModalElement = (function (_BaseElement) {
     babelHelpers.inherits(ModalElement, _BaseElement);

     function ModalElement() {
       babelHelpers.classCallCheck(this, ModalElement);
       return babelHelpers.possibleConstructorReturn(this, Object.getPrototypeOf(ModalElement).apply(this, arguments));
     }

     babelHelpers.createClass(ModalElement, [{
       key: 'createdCallback',

       /**
        * @attribute animation
        * @type {String}
        * @default default
        * @description
        *  [en]The animation used when showing and hiding the modal. Can be either "none" or "fade".[/en]
        *  [ja]モーダルを表示する際のアニメーション名を指定します。"none"もしくは"fade"を指定できます。[/ja]
        */

       /**
        * @attribute animation-options
        * @type {Expression}
        * @description
        *  [en]Specify the animation's duration, timing and delay with an object literal. E.g. <code>{duration: 0.2, delay: 1, timing: 'ease-in'}</code>[/en]
        *  [ja]アニメーション時のduration, timing, delayをオブジェクトリテラルで指定します。e.g. <code>{duration: 0.2, delay: 1, timing: 'ease-in'}</code>[/ja]
        */

       value: function createdCallback() {
         if (!this.hasAttribute('_compiled')) {
           this._compile();
         }

         this._doorLock = new DoorLock();

         this._animatorFactory = new AnimatorFactory({
           animators: _animatorDict$3,
           baseClass: ModalAnimator,
           baseClassName: 'ModalAnimator',
           defaultAnimation: this.getAttribute('animation')
         });
       }

       /**
        * @method getDeviceBackButtonHandler
        * @signature getDeviceBackButtonHandler()
        * @return {Object}
        *   [en]Device back button handler.[/en]
        *   [ja]デバイスのバックボタンハンドラを返します。[/ja]
        * @description
        *   [en]Retrieve the back button handler.[/en]
        *   [ja]ons-modalに紐付いているバックボタンハンドラを取得します。[/ja]
        */

     }, {
       key: 'getDeviceBackButtonHandler',
       value: function getDeviceBackButtonHandler() {
         return this._deviceBackButtonHandler;
       }

       /**
        * @method setDeviceBackButtonHandler
        * @signature setDeviceBackButtonHandler(callback)
        * @return {Function} callback
        *   [en][/en]
        *   [ja][/ja]
        * @description
        *   [en][/en]
        *   [ja][/ja]
        */

     }, {
       key: 'setDeviceBackButtonHandler',
       value: function setDeviceBackButtonHandler(callback) {
         if (this._deviceBackButtonHandler) {
           this._deviceBackButtonHandler.destroy();
         }

         this._deviceBackButtonHandler = deviceBackButtonDispatcher.createHandler(this, callback);
         this._onDeviceBackButton = callback;
       }
     }, {
       key: '_onDeviceBackButton',
       value: function _onDeviceBackButton() {
         // Do nothing and stop device-backbutton handler chain.
         return;
       }
     }, {
       key: '_compile',
       value: function _compile() {
         this.style.display = 'none';
         this.classList.add('modal');

         var wrapper = document.createElement('div');
         wrapper.classList.add('modal__content');

         while (this.childNodes[0]) {
           var node = this.childNodes[0];
           this.removeChild(node);
           wrapper.insertBefore(node, null);
         }

         this.appendChild(wrapper);

         ModifierUtil.initModifier(this, scheme$22);

         this.setAttribute('_compiled', '');
       }
     }, {
       key: 'detachedCallback',
       value: function detachedCallback() {
         if (this._deviceBackButtonHandler) {
           this._deviceBackButtonHandler.destroy();
         }
       }
     }, {
       key: 'attachedCallback',
       value: function attachedCallback() {
         setImmediate(this._ensureNodePosition.bind(this));
         this._deviceBackButtonHandler = deviceBackButtonDispatcher.createHandler(this, this._onDeviceBackButton.bind(this));
       }
     }, {
       key: '_ensureNodePosition',
       value: function _ensureNodePosition() {
         if (!this.parentNode || this.hasAttribute('inline')) {
           return;
         }

         if (this.parentNode.nodeName.toLowerCase() !== 'ons-page') {
           var page = this;
           for (;;) {
             page = page.parentNode;

             if (!page) {
               return;
             }

             if (page.nodeName.toLowerCase() === 'ons-page') {
               break;
             }
           }
           page._registerExtraElement(this);
         }
       }

       /**
        * @method isShown
        * @signature isShown()
        * @return {Boolean}
        *   [en]true if the modal is visible.[/en]
        *   [ja]モーダルが表示されている場合にtrueとなります。[/ja]
        * @description
        *   [en]Returns whether the modal is visible or not.[/en]
        *   [ja]モーダルが表示されているかどうかを返します。[/ja]
        */

     }, {
       key: 'isShown',
       value: function isShown() {
         return this.style.display !== 'none';
       }

       /**
        * @method show
        * @signature show([options])
        * @param {Object} [options]
        *   [en]Parameter object.[/en]
        *   [ja]オプションを指定するオブジェクト。[/ja]
        * @param {String} [options.animation]
        *   [en]Animation name. Available animations are "none" and "fade".[/en]
        *   [ja]アニメーション名を指定します。"none", "fade"のいずれかを指定します。[/ja]
        * @param {String} [options.animationOptions]
        *   [en]Specify the animation's duration, delay and timing. E.g.  <code>{duration: 0.2, delay: 0.4, timing: 'ease-in'}</code>[/en]
        *   [ja]アニメーション時のduration, delay, timingを指定します。e.g. <code>{duration: 0.2, delay: 0.4, timing: 'ease-in'}</code> [/ja]
        * @description
        *   [en]Show modal.[/en]
        *   [ja]モーダルを表示します。[/ja]
        * @return {Promise}
        *   [en]Resolves to the displayed element[/en]
        *   [ja][/ja]
        */

     }, {
       key: 'show',
       value: function show() {
         var _this2 = this;

         var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

         options.animationOptions = util.extend(options.animationOptions || {}, AnimatorFactory.parseAnimationOptionsString(this.getAttribute('animation-options')));

         var callback = options.callback || function () {};

         var tryShow = function tryShow() {
           var unlock = _this2._doorLock.lock();
           var animator = _this2._animatorFactory.newAnimator(options);

           _this2.style.display = 'table';
           return new Promise(function (resolve) {
             animator.show(_this2, function () {
               unlock();

               callback();
               resolve(_this2);
             });
           });
         };

         return new Promise(function (resolve) {
           _this2._doorLock.waitUnlock(function () {
             return resolve(tryShow());
           });
         });
       }

       /**
        * @method toggle
        * @signature toggle([options])
        * @param {Object} [options]
        *   [en]Parameter object.[/en]
        *   [ja]オプションを指定するオブジェクト。[/ja]
        * @param {String} [options.animation]
        *   [en]Animation name. Available animations are "none" and "fade".[/en]
        *   [ja]アニメーション名を指定します。"none", "fade"のいずれかを指定します。[/ja]
        * @param {String} [options.animationOptions]
        *   [en]Specify the animation's duration, delay and timing. E.g.  <code>{duration: 0.2, delay: 0.4, timing: 'ease-in'}</code>[/en]
        *   [ja]アニメーション時のduration, delay, timingを指定します。e.g. <code>{duration: 0.2, delay: 0.4, timing: 'ease-in'}</code> [/ja]
        * @description
        *   [en]Toggle modal visibility.[/en]
        *   [ja]モーダルの表示を切り替えます。[/ja]
        */

     }, {
       key: 'toggle',
       value: function toggle() {
         if (this.isShown()) {
           return this.hide.apply(this, arguments);
         } else {
           return this.show.apply(this, arguments);
         }
       }

       /**
        * @method hide
        * @signature hide([options])
        * @param {Object} [options]
        *   [en]Parameter object.[/en]
        *   [ja]オプションを指定するオブジェクト。[/ja]
        * @param {String} [options.animation]
        *   [en]Animation name. Available animations are "none" and "fade".[/en]
        *   [ja]アニメーション名を指定します。"none", "fade"のいずれかを指定します。[/ja]
        * @param {String} [options.animationOptions]
        *   [en]Specify the animation's duration, delay and timing. E.g.  <code>{duration: 0.2, delay: 0.4, timing: 'ease-in'}</code>[/en]
        *   [ja]アニメーション時のduration, delay, timingを指定します。e.g. <code>{duration: 0.2, delay: 0.4, timing: 'ease-in'}</code> [/ja]
        * @description
        *   [en]Hide modal.[/en]
        *   [ja]モーダルを非表示にします。[/ja]
        * @return {Promise}
        *   [en]Resolves to the hidden element[/en]
        *   [ja][/ja]
        */

     }, {
       key: 'hide',
       value: function hide() {
         var _this3 = this;

         var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

         options.animationOptions = util.extend(options.animationOptions || {}, AnimatorFactory.parseAnimationOptionsString(this.getAttribute('animation-options')));

         var callback = options.callback || function () {};

         var tryHide = function tryHide() {
           var unlock = _this3._doorLock.lock();
           var animator = _this3._animatorFactory.newAnimator(options);

           return new Promise(function (resolve) {
             animator.hide(_this3, function () {
               _this3.style.display = 'none';
               unlock();

               callback();
               resolve(_this3);
             });
           });
         };

         return new Promise(function (resolve) {
           _this3._doorLock.waitUnlock(function () {
             return resolve(tryHide());
           });
         });
       }
     }, {
       key: 'attributeChangedCallback',
       value: function attributeChangedCallback(name, last, current) {
         if (name === 'modifier') {
           return ModifierUtil.onModifierChanged(last, current, this, scheme$22);
         }
       }
     }]);
     return ModalElement;
   })(BaseElement);

   window.OnsModalElement = document.registerElement('ons-modal', {
     prototype: ModalElement.prototype
   });

   /**
    * @param {String} name
    * @param {Function} Animator
    */
   window.OnsModalElement.registerAnimator = function (name, Animator) {
     if (!(Animator.prototype instanceof ModalAnimator)) {
       throw new Error('"Animator" param must inherit OnsModalElement.ModalAnimator');
     }
     _animatorDict$3[name] = Animator;
   };

   window.OnsModalElement.ModalAnimator = ModalAnimator;

   var NavigatorTransitionAnimator = (function () {

     /**
      * @param {Object} options
      * @param {String} options.timing
      * @param {Number} options.duration
      * @param {Number} options.delay
      */

     function NavigatorTransitionAnimator(options) {
       babelHelpers.classCallCheck(this, NavigatorTransitionAnimator);

       options = util.extend({
         timing: 'linear',
         duration: '0.4',
         delay: '0'
       }, options || {});

       this.timing = options.timing;
       this.duration = options.duration;
       this.delay = options.delay;
     }

     babelHelpers.createClass(NavigatorTransitionAnimator, [{
       key: 'push',
       value: function push(enterPage, leavePage, callback) {
         callback();
       }
     }, {
       key: 'pop',
       value: function pop(enterPage, leavePage, callback) {
         callback();
       }
     }]);
     return NavigatorTransitionAnimator;
   })();

   var NoneNavigatorTransitionAnimator = (function (_NavigatorTransitionA) {
     babelHelpers.inherits(NoneNavigatorTransitionAnimator, _NavigatorTransitionA);

     function NoneNavigatorTransitionAnimator(options) {
       babelHelpers.classCallCheck(this, NoneNavigatorTransitionAnimator);
       return babelHelpers.possibleConstructorReturn(this, Object.getPrototypeOf(NoneNavigatorTransitionAnimator).call(this, options));
     }

     babelHelpers.createClass(NoneNavigatorTransitionAnimator, [{
       key: 'push',
       value: function push(enterPage, leavePage, callback) {
         callback();
       }
     }, {
       key: 'pop',
       value: function pop(enterPage, leavePage, callback) {
         callback();
       }
     }]);
     return NoneNavigatorTransitionAnimator;
   })(NavigatorTransitionAnimator);

   /**
    * Fade-in + Lift screen transition.
    */

   var MDFadeNavigatorTransitionAnimator = (function (_NavigatorTransitionA) {
     babelHelpers.inherits(MDFadeNavigatorTransitionAnimator, _NavigatorTransitionA);

     function MDFadeNavigatorTransitionAnimator(options) {
       babelHelpers.classCallCheck(this, MDFadeNavigatorTransitionAnimator);

       options = util.extend({
         timing: 'ease-out',
         duration: '0.25',
         delay: '0.20'
       }, options || {});

       return babelHelpers.possibleConstructorReturn(this, Object.getPrototypeOf(MDFadeNavigatorTransitionAnimator).call(this, options));
     }

     /**
      * @param {Object} enterPage
      * @param {Object} leavePage
      * @param {Function} callback
      */

     babelHelpers.createClass(MDFadeNavigatorTransitionAnimator, [{
       key: 'push',
       value: function push(enterPage, leavePage, callback) {

         animit.runAll(animit(enterPage.element).saveStyle().queue({
           css: {
             transform: 'translate3D(0, 42px, 0)',
             opacity: 0
           },
           duration: 0
         }).wait(this.delay).queue({
           css: {
             transform: 'translate3D(0, 0, 0)',
             opacity: 1
           },
           duration: this.duration,
           timing: this.timing
         }).restoreStyle().queue(function (done) {
           callback();
           done();
         }));
       }

       /**
        * @param {Object} enterPage
        * @param {Object} leavePage
        * @param {Function} done
        */

     }, {
       key: 'pop',
       value: function pop(enterPage, leavePage, callback) {
         animit.runAll(animit(leavePage.element).queue({
           css: {
             transform: 'translate3D(0, 0, 0)'
           },
           duration: 0
         }).wait(0.15).queue({
           css: {
             transform: 'translate3D(0, 38px, 0)'
           },
           duration: this.duration,
           timing: this.timing
         }).queue(function (done) {
           callback();
           done();
         }), animit(leavePage.element).queue({
           css: {
             opacity: 1
           },
           duration: 0
         }).wait(0.04).queue({
           css: {
             opacity: 0
           },
           duration: this.duration,
           timing: this.timing
         }));
       }
     }]);
     return MDFadeNavigatorTransitionAnimator;
   })(NavigatorTransitionAnimator);

   /**
    * Fade-in screen transition.
    */

   var FadeNavigatorTransitionAnimator = (function (_NavigatorTransitionA) {
     babelHelpers.inherits(FadeNavigatorTransitionAnimator, _NavigatorTransitionA);

     function FadeNavigatorTransitionAnimator(options) {
       babelHelpers.classCallCheck(this, FadeNavigatorTransitionAnimator);

       options = util.extend({
         timing: 'linear',
         duration: '0.4',
         delay: '0'
       }, options || {});

       return babelHelpers.possibleConstructorReturn(this, Object.getPrototypeOf(FadeNavigatorTransitionAnimator).call(this, options));
     }

     /**
      * @param {Object} enterPage
      * @param {Object} leavePage
      * @param {Function} callback
      */

     babelHelpers.createClass(FadeNavigatorTransitionAnimator, [{
       key: 'push',
       value: function push(enterPage, leavePage, callback) {

         animit.runAll(animit([enterPage.element._getContentElement(), enterPage.element._getBackgroundElement()]).saveStyle().queue({
           css: {
             transform: 'translate3D(0, 0, 0)',
             opacity: 0
           },
           duration: 0
         }).wait(this.delay).queue({
           css: {
             transform: 'translate3D(0, 0, 0)',
             opacity: 1
           },
           duration: this.duration,
           timing: this.timing
         }).restoreStyle().queue(function (done) {
           callback();
           done();
         }), animit(enterPage.element._getToolbarElement()).saveStyle().queue({
           css: {
             transform: 'translate3D(0, 0, 0)',
             opacity: 0
           },
           duration: 0
         }).wait(this.delay).queue({
           css: {
             transform: 'translate3D(0, 0, 0)',
             opacity: 1
           },
           duration: this.duration,
           timing: this.timing
         }).restoreStyle());
       }

       /**
        * @param {Object} enterPage
        * @param {Object} leavePage
        * @param {Function} done
        */

     }, {
       key: 'pop',
       value: function pop(enterPage, leavePage, callback) {
         animit.runAll(animit([leavePage.element._getContentElement(), leavePage.element._getBackgroundElement()]).queue({
           css: {
             transform: 'translate3D(0, 0, 0)',
             opacity: 1
           },
           duration: 0
         }).wait(this.delay).queue({
           css: {
             transform: 'translate3D(0, 0, 0)',
             opacity: 0
           },
           duration: this.duration,
           timing: this.timing
         }).queue(function (done) {
           callback();
           done();
         }), animit(leavePage.element._getToolbarElement()).queue({
           css: {
             transform: 'translate3D(0, 0, 0)',
             opacity: 1
           },
           duration: 0
         }).wait(this.delay).queue({
           css: {
             transform: 'translate3D(0, 0, 0)',
             opacity: 0
           },
           duration: this.duration,
           timing: this.timing
         }));
       }
     }]);
     return FadeNavigatorTransitionAnimator;
   })(NavigatorTransitionAnimator);

   /**
    * Lift screen transition.
    */

   var LiftNavigatorTransitionAnimator = (function (_NavigatorTransitionA) {
     babelHelpers.inherits(LiftNavigatorTransitionAnimator, _NavigatorTransitionA);

     function LiftNavigatorTransitionAnimator(options) {
       babelHelpers.classCallCheck(this, LiftNavigatorTransitionAnimator);

       options = util.extend({
         duration: 0.4,
         timing: 'cubic-bezier(.1, .7, .1, 1)',
         delay: 0
       }, options || {});

       var _this = babelHelpers.possibleConstructorReturn(this, Object.getPrototypeOf(LiftNavigatorTransitionAnimator).call(this, options));

       _this.backgroundMask = util.createElement('\n      <div style="position: absolute; width: 100%; height: 100%;\n        background-color: black;"></div>\n    ');
       return _this;
     }

     /**
      * @param {Object} enterPage
      * @param {Object} leavePage
      * @param {Function} callback
      */

     babelHelpers.createClass(LiftNavigatorTransitionAnimator, [{
       key: 'push',
       value: function push(enterPage, leavePage, callback) {
         var _this2 = this;

         this.backgroundMask.remove();
         leavePage.element.parentNode.insertBefore(this.backgroundMask, leavePage.element);

         var maskClear = animit(this.backgroundMask).wait(0.6).queue(function (done) {
           _this2.backgroundMask.remove();
           done();
         });

         animit.runAll(maskClear, animit(enterPage.element).saveStyle().queue({
           css: {
             transform: 'translate3D(0, 100%, 0)'
           },
           duration: 0
         }).wait(this.delay).queue({
           css: {
             transform: 'translate3D(0, 0, 0)'
           },
           duration: this.duration,
           timing: this.timing
         }).wait(0.2).restoreStyle().queue(function (done) {
           callback();
           done();
         }), animit(leavePage.element).queue({
           css: {
             transform: 'translate3D(0, 0, 0)',
             opacity: 1.0
           },
           duration: 0
         }).wait(this.delay).queue({
           css: {
             transform: 'translate3D(0, -10%, 0)',
             opacity: 0.9
           },
           duration: this.duration,
           timing: this.timing
         }));
       }

       /**
        * @param {Object} enterPage
        * @param {Object} leavePage
        * @param {Function} callback
        */

     }, {
       key: 'pop',
       value: function pop(enterPage, leavePage, callback) {
         var _this3 = this;

         this.backgroundMask.remove();
         enterPage.element.parentNode.insertBefore(this.backgroundMask, enterPage.element);

         animit.runAll(animit(this.backgroundMask).wait(0.4).queue(function (done) {
           _this3.backgroundMask.remove();
           done();
         }), animit(enterPage.element).queue({
           css: {
             transform: 'translate3D(0, -10%, 0)',
             opacity: 0.9
           },
           duration: 0
         }).wait(this.delay).queue({
           css: {
             transform: 'translate3D(0, 0, 0)',
             opacity: 1.0
           },
           duration: this.duration,
           timing: this.timing
         }).wait(0.4).queue(function (done) {
           callback();
           done();
         }), animit(leavePage.element).queue({
           css: {
             transform: 'translate3D(0, 0, 0)'
           },
           duration: 0
         }).wait(this.delay).queue({
           css: {
             transform: 'translate3D(0, 100%, 0)'
           },
           duration: this.duration,
           timing: this.timing
         }));
       }
     }]);
     return LiftNavigatorTransitionAnimator;
   })(NavigatorTransitionAnimator);

   /**
    * Slide animator for navigator transition.
    */

   var SimpleSlideNavigatorTransitionAnimator = (function (_NavigatorTransitionA) {
     babelHelpers.inherits(SimpleSlideNavigatorTransitionAnimator, _NavigatorTransitionA);

     function SimpleSlideNavigatorTransitionAnimator(options) {
       babelHelpers.classCallCheck(this, SimpleSlideNavigatorTransitionAnimator);

       options = util.extend({
         duration: 0.3,
         timing: 'cubic-bezier(.1, .7, .4, 1)',
         delay: 0
       }, options || {});

       var _this = babelHelpers.possibleConstructorReturn(this, Object.getPrototypeOf(SimpleSlideNavigatorTransitionAnimator).call(this, options));

       _this.backgroundMask = util.createElement('\n      <div style="position: absolute; width: 100%; height: 100%; z-index: 2;\n        background-color: black; opacity: 0;"></div>\n    ');
       _this.blackMaskOpacity = 0.4;
       return _this;
     }

     /**
      * @param {Object} enterPage
      * @param {Object} leavePage
      * @param {Function} callback
      */

     babelHelpers.createClass(SimpleSlideNavigatorTransitionAnimator, [{
       key: 'push',
       value: function push(enterPage, leavePage, callback) {
         var _this2 = this;

         this.backgroundMask.remove();
         leavePage.element.parentElement.insertBefore(this.backgroundMask, leavePage.element.nextSibling);

         animit.runAll(animit(this.backgroundMask).saveStyle().queue({
           opacity: 0,
           transform: 'translate3d(0, 0, 0)'
         }).wait(this.delay).queue({
           opacity: this.blackMaskOpacity
         }, {
           duration: this.duration,
           timing: this.timing
         }).restoreStyle().queue(function (done) {
           _this2.backgroundMask.remove();
           done();
         }), animit(enterPage.element).saveStyle().queue({
           css: {
             transform: 'translate3D(100%, 0, 0)'
           },
           duration: 0
         }).wait(this.delay).queue({
           css: {
             transform: 'translate3D(0, 0, 0)'
           },
           duration: this.duration,
           timing: this.timing
         }).restoreStyle(), animit(leavePage.element).saveStyle().queue({
           css: {
             transform: 'translate3D(0, 0, 0)'
           },
           duration: 0
         }).wait(this.delay).queue({
           css: {
             transform: 'translate3D(-45%, 0px, 0px)'
           },
           duration: this.duration,
           timing: this.timing
         }).restoreStyle().wait(0.2).queue(function (done) {
           callback();
           done();
         }));
       }

       /**
        * @param {Object} enterPage
        * @param {Object} leavePage
        * @param {Function} done
        */

     }, {
       key: 'pop',
       value: function pop(enterPage, leavePage, done) {
         var _this3 = this;

         this.backgroundMask.remove();
         enterPage.element.parentNode.insertBefore(this.backgroundMask, enterPage.element.nextSibling);

         animit.runAll(animit(this.backgroundMask).saveStyle().queue({
           opacity: this.blackMaskOpacity,
           transform: 'translate3d(0, 0, 0)'
         }).wait(this.delay).queue({
           opacity: 0
         }, {
           duration: this.duration,
           timing: this.timing
         }).restoreStyle().queue(function (done) {
           _this3.backgroundMask.remove();
           done();
         }), animit(enterPage.element).saveStyle().queue({
           css: {
             transform: 'translate3D(-45%, 0px, 0px)',
             opacity: 0.9
           },
           duration: 0
         }).wait(this.delay).queue({
           css: {
             transform: 'translate3D(0px, 0px, 0px)',
             opacity: 1.0
           },
           duration: this.duration,
           timing: this.timing
         }).restoreStyle(), animit(leavePage.element).queue({
           css: {
             transform: 'translate3D(0px, 0px, 0px)'
           },
           duration: 0
         }).wait(this.delay).queue({
           css: {
             transform: 'translate3D(100%, 0px, 0px)'
           },
           duration: this.duration,
           timing: this.timing
         }).wait(0.2).queue(function (finish) {
           done();
           finish();
         }));
       }
     }]);
     return SimpleSlideNavigatorTransitionAnimator;
   })(NavigatorTransitionAnimator);

   var NavigatorPage = (function () {

     /**
      * @param {Object} params
      * @param {Object} params.page
      * @param {Object} params.element
      * @param {Object} params.options
      * @param {Object} params.navigator
      * @param {String} params.initialContent
      */

     function NavigatorPage(params) {
       var _this = this;

       babelHelpers.classCallCheck(this, NavigatorPage);

       this.page = params.page;
       this.name = params.page;
       this.element = params.element;
       this.options = params.options;
       this.navigator = params.navigator;
       this.initialContent = params.initialContent;
       this.backButton = util.findChildRecursively(this.element, 'ons-back-button');

       if (this.backButton) {
         CustomElements.upgrade(this.backButton);
       }

       // Block events while page is being animated to stop scrolling, pressing buttons, etc.
       this._blockEvents = function (event) {
         if (_this.navigator._isPopping || _this.navigator._isPushing) {
           event.preventDefault();
           event.stopPropagation();
         }
       };

       this._pointerEvents.forEach(function (event) {
         return _this.element.addEventListener(event, _this._blockEvents);
       }, false);
     }

     babelHelpers.createClass(NavigatorPage, [{
       key: 'getDeviceBackButtonHandler',
       value: function getDeviceBackButtonHandler() {
         return this._deviceBackButtonHandler;
       }

       /**
        * @return {PageView}
        */

     }, {
       key: 'getPageView',
       value: function getPageView() {
         if (!this._page) {
           this._page = util.findParent('ons-page');
           if (!this._page) {
             throw new Error('Fail to fetch ons-page element.');
           }
         }
         return this._page;
       }
     }, {
       key: 'updateBackButton',
       value: function updateBackButton() {
         if (this.backButton) {
           if (this.navigator._pages.length === 1 || this.options._forceHideBackButton) {
             this.backButton.hide();
             this.options._forceHideBackButton = false;
           } else {
             this.backButton.show();
           }
         }
       }
     }, {
       key: 'destroy',
       value: function destroy() {
         var _this2 = this;

         this._pointerEvents.forEach(function (event) {
           return _this2.element.removeEventListener(event, _this2._blockEvents);
         }, false);
         this.element._destroy();

         var index = this.navigator._pages.indexOf(this);
         if (index !== -1) {
           this.navigator._pages.splice(index, 1);
         }

         this.element = this._page = this.options = this.navigator = null;
       }
     }, {
       key: '_pointerEvents',
       get: function get() {
         return ['touchmove'];
       }
     }]);
     return NavigatorPage;
   })();

   /**
    * Slide animator for navigator transition like iOS's screen slide transition.
    */

   var IOSSlideNavigatorTransitionAnimator = (function (_NavigatorTransitionA) {
     babelHelpers.inherits(IOSSlideNavigatorTransitionAnimator, _NavigatorTransitionA);

     function IOSSlideNavigatorTransitionAnimator(options) {
       babelHelpers.classCallCheck(this, IOSSlideNavigatorTransitionAnimator);

       options = util.extend({
         duration: 0.4,
         timing: 'cubic-bezier(.1, .7, .1, 1)',
         delay: 0
       }, options || {});

       var _this = babelHelpers.possibleConstructorReturn(this, Object.getPrototypeOf(IOSSlideNavigatorTransitionAnimator).call(this, options));

       _this.backgroundMask = util.createElement('\n      <div style="position: absolute; width: 100%; height: 100%;\n        background-color: black; opacity: 0;"></div>\n    ');
       return _this;
     }

     babelHelpers.createClass(IOSSlideNavigatorTransitionAnimator, [{
       key: '_decompose',
       value: function _decompose(page) {
         CustomElements.upgrade(page.element);
         var toolbar = page.element._getToolbarElement();
         CustomElements.upgrade(toolbar);
         var left = toolbar._getToolbarLeftItemsElement();
         var right = toolbar._getToolbarRightItemsElement();

         var excludeBackButtonLabel = function excludeBackButtonLabel(elements) {
           var result = [];

           for (var i = 0; i < elements.length; i++) {
             if (elements[i].nodeName.toLowerCase() === 'ons-back-button') {
               var iconElement = elements[i].querySelector('.back-button__icon');
               if (iconElement) {
                 result.push(iconElement);
               }
             } else {
               result.push(elements[i]);
             }
           }

           return result;
         };

         var other = [].concat(left.children.length === 0 ? left : excludeBackButtonLabel(left.children)).concat(right.children.length === 0 ? right : excludeBackButtonLabel(right.children));

         var pageLabels = [toolbar._getToolbarCenterItemsElement(), toolbar._getToolbarBackButtonLabelElement()];

         return {
           pageLabels: pageLabels,
           other: other,
           content: page.element._getContentElement(),
           background: page.element._getBackgroundElement(),
           toolbar: toolbar,
           bottomToolbar: page.element._getBottomToolbarElement()
         };
       }
     }, {
       key: '_shouldAnimateToolbar',
       value: function _shouldAnimateToolbar(enterPage, leavePage) {
         var bothPageHasToolbar = enterPage.element._canAnimateToolbar() && leavePage.element._canAnimateToolbar();

         var noMaterialToolbar = !enterPage.element._getToolbarElement().classList.contains('navigation-bar--material') && !leavePage.element._getToolbarElement().classList.contains('navigation-bar--material');

         return bothPageHasToolbar && noMaterialToolbar;
       }

       /**
        * @param {Object} enterPage
        * @param {Object} leavePage
        * @param {Function} callback
        */

     }, {
       key: 'push',
       value: function push(enterPage, leavePage, callback) {
         var _this2 = this;

         this.backgroundMask.remove();
         leavePage.element.parentNode.insertBefore(this.backgroundMask, leavePage.element.nextSibling);

         var enterPageDecomposition = this._decompose(enterPage);
         var leavePageDecomposition = this._decompose(leavePage);

         var delta = (function () {
           var rect = leavePage.element.getBoundingClientRect();
           return Math.round((rect.right - rect.left) / 2 * 0.6);
         })();

         var maskClear = animit(this.backgroundMask).saveStyle().queue({
           opacity: 0,
           transform: 'translate3d(0, 0, 0)'
         }).wait(this.delay).queue({
           opacity: 0.1
         }, {
           duration: this.duration,
           timing: this.timing
         }).restoreStyle().queue(function (done) {
           _this2.backgroundMask.remove();
           done();
         });

         var shouldAnimateToolbar = this._shouldAnimateToolbar(enterPage, leavePage);

         if (shouldAnimateToolbar) {
           enterPage.element.style.zIndex = 'auto';
           leavePage.element.style.zIndex = 'auto';

           animit.runAll(maskClear, animit([enterPageDecomposition.content, enterPageDecomposition.bottomToolbar, enterPageDecomposition.background]).saveStyle().queue({
             css: {
               transform: 'translate3D(100%, 0px, 0px)'
             },
             duration: 0
           }).wait(this.delay).queue({
             css: {
               transform: 'translate3D(0px, 0px, 0px)'
             },
             duration: this.duration,
             timing: this.timing
           }).restoreStyle(), animit(enterPageDecomposition.pageLabels).saveStyle().queue({
             css: {
               transform: 'translate3d(' + delta + 'px, 0, 0)',
               opacity: 0
             },
             duration: 0
           }).wait(this.delay).queue({
             css: {
               transform: 'translate3d(0, 0, 0)',
               opacity: 1.0
             },
             duration: this.duration,
             timing: this.timing
           }).restoreStyle(), animit(enterPageDecomposition.other).saveStyle().queue({
             css: { opacity: 0 },
             duration: 0
           }).wait(this.delay).queue({
             css: { opacity: 1 },
             duration: this.duration,
             timing: this.timing
           }).restoreStyle(), animit([leavePageDecomposition.content, leavePageDecomposition.bottomToolbar, leavePageDecomposition.background]).saveStyle().queue({
             css: {
               transform: 'translate3D(0, 0, 0)'
             },
             duration: 0
           }).wait(this.delay).queue({
             css: {
               transform: 'translate3D(-25%, 0px, 0px)'
             },
             duration: this.duration,
             timing: this.timing
           }).restoreStyle().queue(function (done) {
             enterPage.element.style.zIndex = '';
             leavePage.element.style.zIndex = '';
             callback();
             done();
           }), animit(leavePageDecomposition.pageLabels).saveStyle().queue({
             css: {
               transform: 'translate3d(0, 0, 0)',
               opacity: 1.0
             },
             duration: 0
           }).wait(this.delay).queue({
             css: {
               transform: 'translate3d(-' + delta + 'px, 0, 0)',
               opacity: 0
             },
             duration: this.duration,
             timing: this.timing
           }).restoreStyle(), animit(leavePageDecomposition.other).saveStyle().queue({
             css: { opacity: 1 },
             duration: 0
           }).wait(this.delay).queue({
             css: { opacity: 0 },
             duration: this.duration,
             timing: this.timing
           }).restoreStyle());
         } else {

           enterPage.element.style.zIndex = 'auto';
           leavePage.element.style.zIndex = 'auto';

           animit.runAll(maskClear, animit(enterPage.element).saveStyle().queue({
             css: {
               transform: 'translate3D(100%, 0px, 0px)'
             },
             duration: 0
           }).wait(this.delay).queue({
             css: {
               transform: 'translate3D(0px, 0px, 0px)'
             },
             duration: this.duration,
             timing: this.timing
           }).restoreStyle(), animit(leavePage.element).saveStyle().queue({
             css: {
               transform: 'translate3D(0, 0, 0)'
             },
             duration: 0
           }).wait(this.delay).queue({
             css: {
               transform: 'translate3D(-25%, 0px, 0px)'
             },
             duration: this.duration,
             timing: this.timing
           }).restoreStyle().queue(function (done) {
             enterPage.element.style.zIndex = '';
             leavePage.element.style.zIndex = '';
             callback();
             done();
           }));
         }
       }

       /**
        * @param {Object} enterPage
        * @param {Object} leavePage
        * @param {Function} done
        */

     }, {
       key: 'pop',
       value: function pop(enterPage, leavePage, done) {
         var _this3 = this;

         this.backgroundMask.remove();
         enterPage.element.parentNode.insertBefore(this.backgroundMask, enterPage.element.nextSibling);

         var enterPageDecomposition = this._decompose(enterPage);
         var leavePageDecomposition = this._decompose(leavePage);

         var delta = (function () {
           var rect = leavePage.element.getBoundingClientRect();
           return Math.round((rect.right - rect.left) / 2 * 0.6);
         })();

         var maskClear = animit(this.backgroundMask).saveStyle().queue({
           opacity: 0.1,
           transform: 'translate3d(0, 0, 0)'
         }).wait(this.delay).queue({
           opacity: 0
         }, {
           duration: this.duration,
           timing: this.timing
         }).restoreStyle().queue(function (done) {
           _this3.backgroundMask.remove();
           done();
         });

         var shouldAnimateToolbar = this._shouldAnimateToolbar(enterPage, leavePage);

         if (shouldAnimateToolbar) {

           enterPage.element.style.zIndex = 'auto';
           leavePage.element.style.zIndex = 'auto';

           animit.runAll(maskClear, animit([enterPageDecomposition.content, enterPageDecomposition.bottomToolbar, enterPageDecomposition.background]).saveStyle().queue({
             css: {
               transform: 'translate3D(-25%, 0px, 0px)',
               opacity: 0.9
             },
             duration: 0
           }).wait(this.delay).queue({
             css: {
               transform: 'translate3D(0px, 0px, 0px)',
               opacity: 1.0
             },
             duration: this.duration,
             timing: this.timing
           }).restoreStyle(), animit(enterPageDecomposition.pageLabels).saveStyle().queue({
             css: {
               transform: 'translate3d(-' + delta + 'px, 0, 0)',
               opacity: 0
             },
             duration: 0
           }).wait(this.delay).queue({
             css: {
               transform: 'translate3d(0, 0, 0)',
               opacity: 1.0
             },
             duration: this.duration,
             timing: this.timing
           }).restoreStyle(), animit(enterPageDecomposition.toolbar).saveStyle().queue({
             css: {
               transform: 'translate3d(0, 0, 0)',
               opacity: 1.0
             },
             duration: 0
           }).wait(this.delay).queue({
             css: {
               transform: 'translate3d(0, 0, 0)',
               opacity: 1.0
             },
             duration: this.duration,
             timing: this.timing
           }).restoreStyle(), animit(enterPageDecomposition.other).saveStyle().queue({
             css: { opacity: 0 },
             duration: 0
           }).wait(this.delay).queue({
             css: { opacity: 1 },
             duration: this.duration,
             timing: this.timing
           }).restoreStyle(), animit([leavePageDecomposition.content, leavePageDecomposition.bottomToolbar, leavePageDecomposition.background]).queue({
             css: {
               transform: 'translate3D(0px, 0px, 0px)'
             },
             duration: 0
           }).wait(this.delay).queue({
             css: {
               transform: 'translate3D(100%, 0px, 0px)'
             },
             duration: this.duration,
             timing: this.timing
           }).wait(0).queue(function (finish) {
             enterPage.element.style.zIndex = '';
             leavePage.element.style.zIndex = '';
             done();
             finish();
           }), animit(leavePageDecomposition.other).queue({
             css: {
               transform: 'translate3d(0, 0, 0)',
               opacity: 1
             },
             duration: 0
           }).wait(this.delay).queue({
             css: {
               transform: 'translate3d(0, 0, 0)',
               opacity: 0
             },
             duration: this.duration,
             timing: this.timing
           }), animit(leavePageDecomposition.toolbar).queue({
             css: {
               background: 'none',
               backgroundColor: 'rgba(0, 0, 0, 0)',
               borderColor: 'rgba(0, 0, 0, 0)'
             },
             duration: 0
           }), animit(leavePageDecomposition.pageLabels).queue({
             css: {
               transform: 'translate3d(0, 0, 0)',
               opacity: 1.0
             },
             duration: 0
           }).wait(this.delay).queue({
             css: {
               transform: 'translate3d(' + delta + 'px, 0, 0)',
               opacity: 0
             },
             duration: this.duration,
             timing: this.timing
           }));
         } else {

           enterPage.element.style.zIndex = 'auto';
           leavePage.element.style.zIndex = 'auto';

           animit.runAll(maskClear, animit(enterPage.element).saveStyle().queue({
             css: {
               transform: 'translate3D(-25%, 0px, 0px)',
               opacity: 0.9
             },
             duration: 0
           }).wait(this.delay).queue({
             css: {
               transform: 'translate3D(0px, 0px, 0px)',
               opacity: 1.0
             },
             duration: this.duration,
             timing: this.timing
           }).restoreStyle(), animit(leavePage.element).queue({
             css: {
               transform: 'translate3D(0px, 0px, 0px)'
             },
             duration: 0
           }).wait(this.delay).queue({
             css: {
               transform: 'translate3D(100%, 0px, 0px)'
             },
             duration: this.duration,
             timing: this.timing
           }).queue(function (finish) {
             enterPage.element.style.zIndex = '';
             leavePage.element.style.zIndex = '';
             done();
             finish();
           }));
         }
       }
     }]);
     return IOSSlideNavigatorTransitionAnimator;
   })(NavigatorTransitionAnimator);

   /**
    * Lift screen transition.
    */

   var MDLiftNavigatorTransitionAnimator = (function (_NavigatorTransitionA) {
     babelHelpers.inherits(MDLiftNavigatorTransitionAnimator, _NavigatorTransitionA);

     function MDLiftNavigatorTransitionAnimator(options) {
       babelHelpers.classCallCheck(this, MDLiftNavigatorTransitionAnimator);

       options = util.extend({
         duration: 0.4,
         timing: 'cubic-bezier(.1, .7, .1, 1)',
         delay: 0.05
       }, options || {});

       var _this = babelHelpers.possibleConstructorReturn(this, Object.getPrototypeOf(MDLiftNavigatorTransitionAnimator).call(this, options));

       _this.backgroundMask = util.createElement('\n      <div style="position: absolute; width: 100%; height: 100%;\n        background-color: black;"></div>\n    ');
       return _this;
     }

     /**
      * @param {Object} enterPage
      * @param {Object} leavePage
      * @param {Function} callback
      */

     babelHelpers.createClass(MDLiftNavigatorTransitionAnimator, [{
       key: 'push',
       value: function push(enterPage, leavePage, callback) {
         var _this2 = this;

         this.backgroundMask.remove();
         leavePage.element.parentNode.insertBefore(this.backgroundMask, leavePage.element);

         var maskClear = animit(this.backgroundMask).wait(0.6).queue(function (done) {
           _this2.backgroundMask.remove();
           done();
         });

         animit.runAll(maskClear, animit(enterPage.element).saveStyle().queue({
           css: {
             transform: 'translate3D(0, 100%, 0)'
           },
           duration: 0
         }).wait(this.delay).queue({
           css: {
             transform: 'translate3D(0, 0, 0)'
           },
           duration: this.duration,
           timing: this.timing
         }).wait(0.5).restoreStyle().queue(function (done) {
           callback();
           done();
         }), animit(leavePage.element).queue({
           css: {
             opacity: 1.0
           },
           duration: 0
         }).wait(0).queue({
           css: {
             opacity: 0.4
           },
           duration: this.duration,
           timing: this.timing
         }));
       }

       /**
        * @param {Object} enterPage
        * @param {Object} leavePage
        * @param {Function} callback
        */

     }, {
       key: 'pop',
       value: function pop(enterPage, leavePage, callback) {
         var _this3 = this;

         this.backgroundMask.remove();
         enterPage.element.parentNode.insertBefore(this.backgroundMask, enterPage.element);

         animit.runAll(animit(this.backgroundMask).wait(0.4).queue(function (done) {
           _this3.backgroundMask.remove();
           done();
         }), animit(enterPage.element).queue({
           css: {
             transform: 'translate3D(0, 0, 0)',
             opacity: 0.4
           },
           duration: 0
         }).wait(this.delay).queue({
           css: {
             transform: 'translate3D(0, 0, 0)',
             opacity: 1.0
           },
           duration: this.duration,
           timing: this.timing
         }).wait(0.4).queue(function (done) {
           callback();
           done();
         }), animit(leavePage.element).queue({
           css: {
             transform: 'translate3D(0, 0, 0)'
           },
           duration: 0
         }).wait(this.delay).queue({
           css: {
             transform: 'translate3D(0, 100%, 0)'
           },
           duration: this.duration,
           timing: this.timing
         }));
       }
     }]);
     return MDLiftNavigatorTransitionAnimator;
   })(NavigatorTransitionAnimator);

   var _animatorDict$2 = {
     'default': function _default() {
       return platform.isAndroid() ? MDFadeNavigatorTransitionAnimator : IOSSlideNavigatorTransitionAnimator;
     },
     'slide': function slide() {
       return platform.isAndroid() ? SimpleSlideNavigatorTransitionAnimator : IOSSlideNavigatorTransitionAnimator;
     },
     'simpleslide': SimpleSlideNavigatorTransitionAnimator,
     'lift': function lift() {
       return platform.isAndroid() ? MDLiftNavigatorTransitionAnimator : LiftNavigatorTransitionAnimator;
     },
     'simplelift': LiftNavigatorTransitionAnimator,
     'fade': FadeNavigatorTransitionAnimator,
     'mdfade': MDFadeNavigatorTransitionAnimator,
     'none': NoneNavigatorTransitionAnimator
   };

   var rewritables$2 = {
     /**
      * @param {Element} navigatorSideElement
      * @param {Function} callback
      */

     ready: function ready(navigatorElement, callback) {
       callback();
     },

     /**
      * @param {Element} navigatorElement
      * @param {Element} target
      * @param {Object} options
      * @param {Function} callback
      */
     link: function link(navigatorElement, target, options, callback) {
       callback(target);
     }
   };

   /**
    * @element ons-navigator
    * @category navigation
    * @description
    *   [en]A component that provides page stack management and navigation. This component does not have a visible content.[/en]
    *   [ja]ページスタックの管理とナビゲーション機能を提供するコンポーネント。画面上への出力はありません。[/ja]
    * @codepen yrhtv
    * @guide PageNavigation
    *   [en]Guide for page navigation[/en]
    *   [ja]ページナビゲーションの概要[/ja]
    * @guide CallingComponentAPIsfromJavaScript
    *   [en]Using navigator from JavaScript[/en]
    *   [ja]JavaScriptからコンポーネントを呼び出す[/ja]
    * @guide EventHandling
    *   [en]Event handling descriptions[/en]
    *   [ja]イベント処理の使い方[/ja]
    * @guide DefiningMultiplePagesinSingleHTML
    *   [en]Defining multiple pages in single html[/en]
    *   [ja]複数のページを1つのHTMLに記述する[/ja]
    * @seealso ons-toolbar
    *   [en]ons-toolbar component[/en]
    *   [ja]ons-toolbarコンポーネント[/ja]
    * @seealso ons-back-button
    *   [en]ons-back-button component[/en]
    *   [ja]ons-back-buttonコンポーネント[/ja]
    * @example
    * <ons-navigator animation="slide" var="app.navi">
    *   <ons-page>
    *     <ons-toolbar>
    *       <div class="center">Title</div>
    *     </ons-toolbar>
    *
    *     <p style="text-align: center">
    *       <ons-button modifier="light" ng-click="app.navi.pushPage('page.html');">Push</ons-button>
    *     </p>
    *   </ons-page>
    * </ons-navigator>
    *
    * <ons-template id="page.html">
    *   <ons-page>
    *     <ons-toolbar>
    *       <div class="center">Title</div>
    *     </ons-toolbar>
    *
    *     <p style="text-align: center">
    *       <ons-button modifier="light" ng-click="app.navi.popPage();">Pop</ons-button>
    *     </p>
    *   </ons-page>
    * </ons-template>
    */

   var NavigatorElement = (function (_BaseElement) {
     babelHelpers.inherits(NavigatorElement, _BaseElement);

     function NavigatorElement() {
       babelHelpers.classCallCheck(this, NavigatorElement);
       return babelHelpers.possibleConstructorReturn(this, Object.getPrototypeOf(NavigatorElement).apply(this, arguments));
     }

     babelHelpers.createClass(NavigatorElement, [{
       key: 'createdCallback',

       /**
        * @attribute animation-options
        * @type {Expression}
        * @description
        *  [en]Specify the animation's duration, timing and delay with an object literal. E.g. <code>{duration: 0.2, delay: 1, timing: 'ease-in'}</code>[/en]
        *  [ja]アニメーション時のduration, timing, delayをオブジェクトリテラルで指定します。e.g. <code>{duration: 0.2, delay: 1, timing: 'ease-in'}</code>[/ja]
        */

       /**
        * @attribute page
        * @initonly
        * @type {String}
        * @description
        *   [en]First page to show when navigator is initialized.[/en]
        *   [ja]ナビゲーターが初期化された時に表示するページを指定します。[/ja]
        */

       /**
        * @attribute animation
        * @type {String}
        * @default default
        * @description
        *  [en]Specify the transition animation. Use one of "slide", "simpleslide", "fade", "lift", "none" and "default".[/en]
        *  [ja]画面遷移する際のアニメーションを指定します。"slide", "simpleslide", "fade", "lift", "none", "default"のいずれかを指定できます。[/ja]
        */

       /**
        * @attribute prepush
        * @description
        *   [en]Fired just before a page is pushed.[/en]
        *   [ja]pageがpushされる直前に発火されます。[/ja]
        * @param {Object} event [en]Event object.[/en]
        * @param {Object} event.navigator
        *   [en]Component object.[/en]
        *   [ja]コンポーネントのオブジェクト。[/ja]
        * @param {Object} event.currentPage
        *   [en]Current page object.[/en]
        *   [ja]現在のpageオブジェクト。[/ja]
        * @param {Function} event.cancel
        *   [en]Call this function to cancel the push.[/en]
        *   [ja]この関数を呼び出すと、push処理がキャンセルされます。[/ja]
        */

       /**
        * @attribute prepop
        * @description
        *   [en]Fired just before a page is popped.[/en]
        *   [ja]pageがpopされる直前に発火されます。[/ja]
        * @param {Object} event [en]Event object.[/en]
        * @param {Object} event.navigator
        *   [en]Component object.[/en]
        *   [ja]コンポーネントのオブジェクト。[/ja]
        * @param {Object} event.currentPage
        *   [en]Current page object.[/en]
        *   [ja]現在のpageオブジェクト。[/ja]
        * @param {Function} event.cancel
        *   [en]Call this function to cancel the pop.[/en]
        *   [ja]この関数を呼び出すと、pageのpopがキャンセルされます。[/ja]
        */

       /**
        * @attribute postpush
        * @description
        *   [en]Fired just after a page is pushed.[/en]
        *   [ja]pageがpushされてアニメーションが終了してから発火されます。[/ja]
        * @param {Object} event [en]Event object.[/en]
        * @param {Object} event.navigator
        *   [en]Component object.[/en]
        *   [ja]コンポーネントのオブジェクト。[/ja]
        * @param {Object} event.enterPage
        *   [en]Object of the next page.[/en]
        *   [ja]pushされたpageオブジェクト。[/ja]
        * @param {Object} event.leavePage
        *   [en]Object of the previous page.[/en]
        *   [ja]以前のpageオブジェクト。[/ja]
        */

       /**
        * @event postpop
        * @description
        *   [en]Fired just after a page is popped.[/en]
        *   [ja]pageがpopされてアニメーションが終わった後に発火されます。[/ja]
        * @param {Object} event [en]Event object.[/en]
        * @param {Object} event.navigator
        *   [en]Component object.[/en]
        *   [ja]コンポーネントのオブジェクト。[/ja]
        * @param {Object} event.enterPage
        *   [en]Object of the next page.[/en]
        *   [ja]popされて表示されるページのオブジェクト。[/ja]
        * @param {Object} event.leavePage
        *   [en]Object of the previous page.[/en]
        *   [ja]popされて消えるページのオブジェクト。[/ja]
        */
       value: function createdCallback() {
         this._doorLock = new DoorLock();
         this._pages = [];
         this._boundOnDeviceBackButton = this._onDeviceBackButton.bind(this);
         this._isPushing = this._isPopping = false;
         this.options = {
           cancelIfRunning: true
         };

         this._initialHTML = this.innerHTML;
         this.innerHTML = '';

         this._animatorFactory = new AnimatorFactory({
           animators: _animatorDict$2,
           baseClass: NavigatorTransitionAnimator,
           baseClassName: 'NavigatorTransitionAnimator',
           defaultAnimation: this.getAttribute('animation')
         });
       }

       /**
        * @property {object} [options]
        * @description
        *   [en]Default options object.[/en]
        *   [ja][/ja]
        */

     }, {
       key: 'canPopPage',

       /**
        * @return {Boolean}
        */
       value: function canPopPage() {
         return this._pages.length > 1;
       }

       /**
        * @method replacePage
        * @signature replacePage(pageUrl, [options])
        * @param {String} [pageUrl]
        *   [en]Page URL. Can be either a HTML document or an <code>&lt;ons-template&gt;</code>.[/en]
        *   [ja]pageのURLか、もしくはons-templateで宣言したテンプレートのid属性の値を指定できます。[/ja]
        * @param {Object} [options]
        *   [en]Parameter object.[/en]
        *   [ja]オプションを指定するオブジェクト。[/ja]
        * @param {String} [options.page]
        *   [en]PageURL. Only necssary if `page` parameter is omitted.[/en]
        *   [ja][/ja]
        * @param {String} [options.pageHTML]
        *   [en]HTML code that will be computed as a new page. Overwrites `page` parameter.[/en]
        *   [ja][/ja]
        * @param {String} [options.animation]
        *   [en]Animation name. Available animations are "slide", "simpleslide", "lift", "fade" and "none".[/en]
        *   [ja]アニメーション名を指定できます。"slide", "simpleslide", "lift", "fade", "none"のいずれかを指定できます。[/ja]
        * @param {String} [options.animationOptions]
        *   [en]Specify the animation's duration, delay and timing. E.g.  <code>{duration: 0.2, delay: 0.4, timing: 'ease-in'}</code>[/en]
        *   [ja]アニメーション時のduration, delay, timingを指定します。e.g. <code>{duration: 0.2, delay: 0.4, timing: 'ease-in'}</code> [/ja]
        * @param {Function} [options.onTransitionEnd]
        *   [en]Function that is called when the transition has ended.[/en]
        *   [ja]このメソッドによる画面遷移が終了した際に呼び出される関数オブジェクトを指定します。[/ja]
        * @description
        *   [en]Replaces the current page with the specified one.[/en]
        *   [ja]現在表示中のページをを指定したページに置き換えます。[/ja]
        */

       /**
        * Replaces the current page with the specified one.
        *
        * @param {String} page
        * @param {Object} [options]
        */

     }, {
       key: 'replacePage',
       value: function replacePage(page) {
         var _this2 = this;

         var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

         if ((typeof page === 'undefined' ? 'undefined' : babelHelpers.typeof(page)) === 'object' && page !== null) {
           options = page;
         } else {
           options.page = page;
         }

         if (options && (typeof options === 'undefined' ? 'undefined' : babelHelpers.typeof(options)) != 'object') {
           throw new Error('options must be an object. You supplied ' + options);
         }

         var onTransitionEnd = options.onTransitionEnd || function () {};

         if (this._pages.length === 1) {
           options._forceHideBackButton = true;
         }

         options.onTransitionEnd = function () {
           if (_this2._pages.length > 1) {
             _this2._pages[_this2._pages.length - 2].destroy();
           }
           onTransitionEnd();
         };

         return this.pushPage(options.page, options);
       }

       /**
        * @method popPage
        * @signature popPage([options])
        * @param {Object} [options]
        *   [en]Parameter object.[/en]
        *   [ja]オプションを指定するオブジェクト。[/ja]
        * @param {String} [options.animation]
        *   [en]Animation name. Available animations are "slide", "simpleslide", "lift", "fade" and "none".[/en]
        *   [ja]アニメーション名を指定します。"slide", "simpleslide", "lift", "fade", "none"のいずれかを指定できます。[/ja]
        * @param {String} [options.animationOptions]
        *   [en]Specify the animation's duration, delay and timing. E.g.  <code>{duration: 0.2, delay: 0.4, timing: 'ease-in'}</code>[/en]
        *   [ja]アニメーション時のduration, delay, timingを指定します。e.g. <code>{duration: 0.2, delay: 0.4, timing: 'ease-in'}</code> [/ja]
        * @param {Boolean} [options.refresh]
        *   [en]The previous page will be refreshed (destroyed and created again) before popPage action.[/en]
        *   [ja]popPageする前に、前にあるページを生成しなおして更新する場合にtrueを指定します。[/ja]
        * @param {Function} [options.onTransitionEnd]
        *   [en]Function that is called when the transition has ended.[/en]
        *   [ja]このメソッドによる画面遷移が終了した際に呼び出される関数オブジェクトを指定します。[/ja]
        * @description
        *   [en]Pops the current page from the page stack. The previous page will be displayed.[/en]
        *   [ja]現在表示中のページをページスタックから取り除きます。一つ前のページに戻ります。[/ja]
        */

       /**
        * Pops current page from the page stack.
        *
        * @param {Object} [options]
        * @param {String} [options.animation]
        * @param {Object} [options.animationOptions]
        * @param {Boolean} [options.refresh]
        * @param {Function} [options.onTransitionEnd]
        * @param {Boolean} [options.cancelIfRunning]
        * @return {Promise} Resolves to the new top page object.
        */

     }, {
       key: 'popPage',
       value: function popPage() {
         var _this3 = this;

         var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

         if (options && (typeof options === 'undefined' ? 'undefined' : babelHelpers.typeof(options)) != 'object') {
           throw new Error('options must be an object. You supplied ' + options);
         }

         options = util.extend({}, this.options || {}, options);

         if (options.cancelIfRunning && this._isPopping) {
           return Promise.reject('popPage is already running.');
         }

         options.animationOptions = util.extend(options.animationOptions || {}, AnimatorFactory.parseAnimationOptionsString(this.getAttribute('animation-options')));

         var tryPopPage = function tryPopPage() {
           if (_this3._pages.length <= 1) {
             throw new Error('ons-navigator\'s page stack is empty.');
           }

           if (_this3._emitPrePopEvent()) {
             return Promise.reject('Canceled in prepop event.');
           }

           var unlock = _this3._doorLock.lock();

           if (options.refresh) {
             var _ret = (function () {
               var index = _this3._pages.length - 2;

               if (!_this3._pages[index].page) {
                 throw new Error('Refresh option cannot be used with pages directly inside the Navigator. Use ons-template instead.');
               }

               return {
                 v: internal.getPageHTMLAsync(_this3._pages[index].page).then(function (templateHTML) {
                   var element = _this3._createPageElement(templateHTML);
                   var pageObject = _this3._createPageObject(_this3._pages[index].page, element, _this3._pages[index].options);

                   return new Promise(function (resolve) {
                     rewritables$2.link(_this3, element, _this3._pages[index].options, function (element) {
                       _this3.insertBefore(element, _this3._pages[index] ? _this3._pages[index].element : null);
                       _this3._pages.splice(index, 0, pageObject);

                       _this3._pages[index + 1].destroy();
                       resolve(_this3._popPage(options, unlock));
                     });
                   });
                 })
               };
             })();

             if ((typeof _ret === 'undefined' ? 'undefined' : babelHelpers.typeof(_ret)) === "object") return _ret.v;
           } else {
             return _this3._popPage(options, unlock);
           }
         };

         return new Promise(function (resolve) {
           _this3._doorLock.waitUnlock(function () {
             return resolve(tryPopPage());
           });
         });
       }
     }, {
       key: '_popPage',
       value: function _popPage(options, unlock) {
         var _this4 = this;

         options.animationOptions = util.extend(options.animationOptions || {}, AnimatorFactory.parseAnimationOptionsString(this.getAttribute('animation-options')));

         var leavePage = this._pages.pop();
         var enterPage = this._pages[this._pages.length - 1];

         enterPage.updateBackButton();

         leavePage.element._hide();
         if (enterPage) {
           enterPage.element.style.display = 'block';
           enterPage.element._show();
         }

         // for "postpop" event
         var eventDetail = {
           leavePage: leavePage,
           enterPage: this._pages[this._pages.length - 1],
           navigator: this
         };

         return new Promise(function (resolve) {
           var callback = function callback() {
             leavePage.destroy();

             _this4._isPopping = false;
             unlock();

             var event = util.triggerElementEvent(_this4, 'postpop', eventDetail);
             event.leavePage = null;

             if (typeof options.onTransitionEnd === 'function') {
               options.onTransitionEnd();
             }

             resolve(enterPage);
           };

           _this4._isPopping = true;

           var animator = _this4._animatorFactory.newAnimator(options, leavePage.options.animator);
           animator.pop(enterPage, leavePage, callback);
         });
       }

       /**
        * @method insertPage
        * @signature insertPage(index, pageUrl, [options])
        * @param {Number} index
        *   [en]The index where it should be inserted.[/en]
        *   [ja]スタックに挿入する位置のインデックスを指定します。[/ja]
        * @param {String} pageUrl
        *   [en]Page URL. Can be either a HTML document or a <code>&lt;ons-template&gt;</code>.[/en]
        *   [ja]pageのURLか、もしくはons-templateで宣言したテンプレートのid属性の値を指定できます。[/ja]
        * @param {Object} [options]
        *   [en]Parameter object.[/en]
        *   [ja]オプションを指定するオブジェクト。[/ja]
        * @param {String} [options.animation]
        *   [en]Animation name. Available animations are "slide", "simpleslide", "lift", "fade" and "none".[/en]
        *   [ja]アニメーション名を指定します。"slide", "simpleslide", "lift", "fade", "none"のいずれかを指定できます。[/ja]
        * @description
        *   [en]Insert the specified pageUrl into the page stack with specified index.[/en]
        *   [ja]指定したpageUrlをページスタックのindexで指定した位置に追加します。[/ja]
        */

       /**
        * Insert page object that has the specified pageUrl into the page stack and
        * if options object is specified, apply the options.
        *
        * @param {Number} index
        * @param {String} page
        * @param {Object} [options]
        * @param {String/NavigatorTransitionAnimator} [options.animation]
        * @return {Promise} Resolves to the inserted page object
        */

     }, {
       key: 'insertPage',
       value: function insertPage(index, page) {
         var _this5 = this;

         var options = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

         if ((typeof page === 'undefined' ? 'undefined' : babelHelpers.typeof(page)) === 'object' && page !== null) {
           options = page;
         } else {
           options.page = page;
         }

         if (options && (typeof options === 'undefined' ? 'undefined' : babelHelpers.typeof(options)) != 'object') {
           throw new Error('options must be an object. You supplied ' + options);
         }

         index = this._normalizeIndex(index);

         if (index >= this._pages.length) {
           return this.pushPage.apply(this, [].slice.call(arguments, 1));
         }

         var tryInsertPage = function tryInsertPage() {
           var unlock = _this5._doorLock.lock();

           var run = function run(templateHTML) {
             var element = _this5._createPageElement(templateHTML);
             var pageObject = _this5._createPageObject(page, element, options);

             return new Promise(function (resolve) {
               rewritables$2.link(_this5, element, options, function (element) {
                 element.style.display = 'none';
                 _this5.insertBefore(element, _this5._pages[index].element);
                 _this5._pages.splice(index, 0, pageObject);
                 _this5.getCurrentPage().updateBackButton();

                 setTimeout(function () {
                   unlock();
                   element = null;
                   resolve(_this5._pages[index]);
                 }, 1000 / 60);
               });
             });
           };

           if (options.pageHTML) {
             return run(options.pageHTML);
           } else {
             return internal.getPageHTMLAsync(page).then(run);
           }
         };

         return new Promise(function (resolve) {
           _this5._doorLock.waitUnlock(function () {
             return resolve(tryInsertPage());
           });
         });
       }
     }, {
       key: '_normalizeIndex',
       value: function _normalizeIndex(index) {
         if (index < 0) {
           index = Math.abs(this._pages.length + index) % this._pages.length;
         }
         return index;
       }

       /**
        * @method getCurrentPage
        * @signature getCurrentPage()
        * @return {Object}
        *   [en]Current page object.[/en]
        *   [ja]現在のpageオブジェクト。[/ja]
        * @description
        *   [en]Get current page's navigator item. Use this method to access options passed by pushPage() or resetToPage() method.[/en]
        *   [ja]現在のページを取得します。pushPage()やresetToPage()メソッドの引数を取得できます。[/ja]
        */

       /**
        * Get current page's navigator item.
        *
        * Use this method to access options passed by pushPage() or resetToPage() method.
        * eg. ons.navigator.getCurrentPage().options
        *
        * @return {Object}
        */

     }, {
       key: 'getCurrentPage',
       value: function getCurrentPage() {
         if (this._pages.length <= 0) {
           throw new Error('Invalid state');
         }
         return this._pages[this._pages.length - 1];
       }
     }, {
       key: '_show',
       value: function _show() {
         if (this._pages[this._pages.length - 1]) {
           this._pages[this._pages.length - 1].element._show();
         }
       }
     }, {
       key: '_hide',
       value: function _hide() {
         if (this._pages[this._pages.length - 1]) {
           this._pages[this._pages.length - 1].element._hide();
         }
       }
     }, {
       key: '_destroy',
       value: function _destroy() {
         for (var i = this._pages.length - 1; i >= 0; i--) {
           this._pages[i].destroy();
         }
         this.remove();
       }
     }, {
       key: '_onDeviceBackButton',
       value: function _onDeviceBackButton(event) {
         if (this._pages.length > 1) {
           this.popPage();
         } else {
           event.callParentHandler();
         }
       }

       /**
        * @method resetTopage
        * @signature resetToPage(pageUrl, [options])
        * @param {String/undefined} [pageUrl]
        *   [en]Page URL. Can be either a HTML document or an <code>&lt;ons-template&gt;</code>. If the value is undefined or '', the navigator will be reset to the page that was first displayed.[/en]
        *   [ja]pageのURLか、もしくはons-templateで宣言したテンプレートのid属性の値を指定できます。undefinedや''を指定すると、ons-navigatorが最初に表示したページを指定したことになります。[/ja]
        * @param {Object} [options]
        *   [en]Parameter object.[/en]
        *   [ja]オプションを指定するオブジェクト。[/ja]
        * @param {String} [options.page]
        *   [en]PageURL. Only necssary if `page` parameter is omitted.[/en]
        *   [ja][/ja]
        * @param {String} [options.pageHTML]
        *   [en]HTML code that will be computed as a new page. Overwrites `page` parameter.[/en]
        *   [ja][/ja]
        * @param {String} [options.animation]
        *   [en]Animation name. Available animations are "slide", "simpleslide", "lift", "fade" and "none".[/en]
        *   [ja]アニメーション名を指定できます。"slide", "simpleslide", "lift", "fade", "none"のいずれかを指定できます。[/ja]
        * @param {Function} [options.onTransitionEnd]
        *   [en]Function that is called when the transition has ended.[/en]
        *   [ja]このメソッドによる画面遷移が終了した際に呼び出される関数オブジェクトを指定します。[/ja]
        * @description
        *   [en]Clears page stack and adds the specified pageUrl to the page stack.[/en]
        *   [ja]ページスタックをリセットし、指定したページを表示します。[/ja]
        */

       /**
        * Clears page stack and add the specified pageUrl to the page stack.
        * If options object is specified, apply the options.
        * the options object include all the attributes of this navigator.
        *
        * If page is undefined, navigator will push initial page contents instead of.
        *
        * @param {String/undefined} page
        * @param {Object} [options]
        * @return {Promise} Resolves to the new top page object.
        */

     }, {
       key: 'resetToPage',
       value: function resetToPage(page) {
         var _this6 = this;

         var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

         if ((typeof page === 'undefined' ? 'undefined' : babelHelpers.typeof(page)) === 'object' && page !== null) {
           options = page;
         } else {
           options.page = page;
         }

         if (options && (typeof options === 'undefined' ? 'undefined' : babelHelpers.typeof(options)) != 'object') {
           throw new Error('options must be an object. You supplied ' + options);
         }

         if (!options.animator && !options.animation) {
           options.animation = 'none';
         }

         var onTransitionEnd = options.onTransitionEnd || function () {};

         options.onTransitionEnd = function () {
           while (_this6._pages.length > 1) {
             _this6._pages.shift().destroy();
           }
           _this6._pages[0].updateBackButton();
           onTransitionEnd();
         };

         if (!options.pageHTML && (options.page === undefined || page === '')) {
           if (this.hasAttribute('page')) {
             options.page = this.getAttribute('page');
           } else {
             options.pageHTML = this._initialHTML;
             options.page = '';
           }
         }

         return this.pushPage(options.page, options);
       }
     }, {
       key: 'attributeChangedCallback',
       value: function attributeChangedCallback(name, last, current) {}
     }, {
       key: 'attachedCallback',
       value: function attachedCallback() {
         var _this7 = this;

         this._deviceBackButtonHandler = deviceBackButtonDispatcher.createHandler(this, this._boundOnDeviceBackButton);

         rewritables$2.ready(this, function () {
           if (_this7._pages.length === 0) {
             if (!_this7.getAttribute('page')) {
               var element = _this7._createPageElement(_this7._initialHTML || '');

               _this7._pushPageDOM(_this7._createPageObject('', element, {}), function () {});
             } else {
               _this7.pushPage(_this7.getAttribute('page'), { animation: 'none' });
             }
           }
         });
       }
     }, {
       key: 'detachedCallback',
       value: function detachedCallback() {
         this._deviceBackButtonHandler.destroy();
         this._deviceBackButtonHandler = null;
       }

       /**
        * @method pushPage
        * @signature pushPage(page, [options])
        * @param {String} [page]
        *   [en]Page URL. Can be either a HTML document or a <code>&lt;ons-template&gt;</code>.[/en]
        *   [ja]pageのURLか、もしくはons-templateで宣言したテンプレートのid属性の値を指定できます。[/ja]
        * @param {Object} [options]
        *   [en]Parameter object.[/en]
        *   [ja]オプションを指定するオブジェクト。[/ja]
        * @param {String} [options.page]
        *   [en]PageURL. Only necssary if `page` parameter is omitted.[/en]
        *   [ja][/ja]
        * @param {String} [options.pageHTML]
        *   [en]HTML code that will be computed as a new page. Overwrites `page` parameter.[/en]
        *   [ja][/ja]
        * @param {String} [options.animation]
        *   [en]Animation name. Available animations are "slide", "simpleslide", "lift", "fade" and "none".[/en]
        *   [ja]アニメーション名を指定します。"slide", "simpleslide", "lift", "fade", "none"のいずれかを指定できます。[/ja]
        * @param {String} [options.animationOptions]
        *   [en]Specify the animation's duration, delay and timing. E.g.  <code>{duration: 0.2, delay: 0.4, timing: 'ease-in'}</code>[/en]
        *   [ja]アニメーション時のduration, delay, timingを指定します。e.g. <code>{duration: 0.2, delay: 0.4, timing: 'ease-in'}</code> [/ja]
        * @param {Function} [options.onTransitionEnd]
        *   [en]Function that is called when the transition has ended.[/en]
        *   [ja]pushPage()による画面遷移が終了した時に呼び出される関数オブジェクトを指定します。[/ja]
        * @description
        *   [en]Pushes the specified pageUrl into the page stack.[/en]
        *   [ja]指定したpageUrlを新しいページスタックに追加します。新しいページが表示されます。[/ja]
        */

       /**
        * Pushes the specified pageUrl into the page stack and
        * if options object is specified, apply the options.
        *
        * @param {String} page
        * @param {Object} [options]
        * @param {String/NavigatorTransitionAnimator} [options.animation]
        * @param {Object} [options.animationOptions]
        * @param {Function} [options.onTransitionEnd]
        * @param {Boolean} [options.cancelIfRunning]
        * @param {String} [options.pageHTML]
        * @return {Promise} Resolves to the new top page object.
        */

     }, {
       key: 'pushPage',
       value: function pushPage(page) {
         var _this8 = this;

         var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

         if ((typeof page === 'undefined' ? 'undefined' : babelHelpers.typeof(page)) === 'object' && page !== null) {
           options = page;
         } else {
           options.page = page;
         }

         if (options && (typeof options === 'undefined' ? 'undefined' : babelHelpers.typeof(options)) != 'object') {
           throw new Error('options must be an object. You supplied ' + options);
         }

         options = util.extend({}, this.options || {}, options);

         if (options.cancelIfRunning && this._isPushing) {
           return Promise.reject('pushPage is already running.');
         }

         if (this._emitPrePushEvent()) {
           return Promise.reject('Canceled in prepush event.');
         }

         options.animationOptions = util.extend(options.animationOptions || {}, AnimatorFactory.parseAnimationOptionsString(this.getAttribute('animation-options')));

         this._isPushing = true;

         return new Promise(function (resolve) {
           _this8._doorLock.waitUnlock(function () {
             return resolve(_this8._pushPage(options));
           });
         });
       }
     }, {
       key: '_pushPage',
       value: function _pushPage(options) {
         var _this9 = this;

         var unlock = this._doorLock.lock();
         var done = function done() {
           unlock();
         };

         var run = function run(templateHTML) {
           var element = _this9._createPageElement(templateHTML);
           return _this9._pushPageDOM(_this9._createPageObject(options.page, element, options), done);
         };

         if (options.pageHTML) {
           return run(options.pageHTML);
         } else {
           return internal.getPageHTMLAsync(options.page).then(run);
         }
       }

       /**
        * @param {Object} pageObject
        * @param {Function} [unlock]
        */

     }, {
       key: '_pushPageDOM',
       value: function _pushPageDOM(pageObject, unlock) {
         var _this10 = this;

         unlock = unlock || function () {};

         var element = pageObject.element;
         var options = pageObject.options;

         // for "postpush" event
         var eventDetail = {
           enterPage: pageObject,
           leavePage: this._pages[this._pages.length - 1],
           navigator: this
         };

         this._pages.push(pageObject);
         pageObject.updateBackButton();

         return new Promise(function (resolve) {

           var done = function done() {
             if (_this10._pages[_this10._pages.length - 2]) {
               _this10._pages[_this10._pages.length - 2].element.style.display = 'none';
             }

             _this10._isPushing = false;
             unlock();

             util.triggerElementEvent(_this10, 'postpush', eventDetail);

             if (typeof options.onTransitionEnd === 'function') {
               options.onTransitionEnd();
             }
             element = null;

             resolve(_this10._pages[_this10._pages.length - 1]);
           };

           _this10._isPushing = true;

           rewritables$2.link(_this10, element, options, function (element) {
             CustomElements.upgrade(element);

             setTimeout(function () {
               if (_this10._pages.length > 1) {
                 var leavePage = _this10._pages.slice(-2)[0];
                 var enterPage = _this10._pages.slice(-1)[0];

                 _this10.appendChild(element);
                 leavePage.element._hide();
                 enterPage.element._show();

                 options.animator.push(enterPage, leavePage, done);
               } else {
                 _this10.appendChild(element);
                 element._show();

                 done();
               }
             }, 1000 / 60);
           });
         });
       }

       /**
        * @method bringPageTop
        * @signature bringPageTop(item, [options])
        * @param {String|Number} item
        *   [en]Page URL or index of an existing page in navigator's stack.[/en]
        *   [ja]ページのURLかもしくはons-navigatorのページスタックのインデックス値を指定します。[/ja]
        * @param {Object} [options]
        *   [en]Parameter object.[/en]
        *   [ja]オプションを指定するオブジェクト。[/ja]
        * @param {String} [options.animation]
        *   [en]Animation name. Available animations are "slide", "simpleslide", "lift", "fade" and "none".[/en]
        *   [ja]アニメーション名を指定します。"slide", "simpleslide", "lift", "fade", "none"のいずれかを指定できます。[/ja]
        * @param {String} [options.animationOptions]
        *   [en]Specify the animation's duration, delay and timing. E.g.  <code>{duration: 0.2, delay: 0.4, timing: 'ease-in'}</code>[/en]
        *   [ja]アニメーション時のduration, delay, timingを指定します。e.g. <code>{duration: 0.2, delay: 0.4, timing: 'ease-in'}</code> [/ja]
        * @param {Function} [options.onTransitionEnd]
        *   [en]Function that is called when the transition has ended.[/en]
        *   [ja]pushPage()による画面遷移が終了した時に呼び出される関数オブジェクトを指定します。[/ja]
        * @description
        *   [en]Brings the given page to the top of the page-stack if already exists or pushes it into the stack if doesn't.[/en]
        *   [ja]指定したページをページスタックの一番上に移動します。もし指定したページが無かった場合新しくpushされます。[/ja]
        */

       /**
        * Brings the given pageUrl or index to the top of the page stack
        * if already exists or pushes the page into the stack if doesn't.
        * If options object is specified, apply the options.
        *
        * @param {String|Number} item Page name or valid index.
        * @param {Object} options
        * @return {Promise} Resolves to the new top page object.
        */

     }, {
       key: 'bringPageTop',
       value: function bringPageTop(item) {
         var _this11 = this;

         var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

         if (options && (typeof options === 'undefined' ? 'undefined' : babelHelpers.typeof(options)) != 'object') {
           throw new Error('options must be an object. You supplied ' + options);
         }

         options = util.extend({}, this.options || {}, options);

         if (options.cancelIfRunning && this._isPushing) {
           return Promise.reject('pushPage is already running.');
         }

         if (this._emitPrePushEvent()) {
           return Promise.reject('Canceled in prepush event.');
         }

         var index = undefined;
         if (typeof item === 'string') {
           options.page = item;
           index = this._lastIndexOfPage(options.page);
         } else if (typeof item === 'number') {
           index = this._normalizeIndex(item);
           if (item >= this._pages.length) {
             throw new Error('The provided index does not match an existing page.');
           }
           options.page = this._pages[index].page;
         } else {
           throw new Error('First argument must be a page name or the index of an existing page. You supplied ' + item);
         }

         if (index < 0) {
           // Fallback pushPage
           return new Promise(function (resolve) {
             _this11._doorLock.waitUnlock(function () {
               return resolve(_this11._pushPage(options));
             });
           });
         } else if (index === this._pages.length - 1) {
           // Page is already the top
           return Promise.resolve(this._pages[index]);
         } else {
           var _ret2 = (function () {
             // Bring to top
             var tryBringPageTop = function tryBringPageTop() {
               var unlock = _this11._doorLock.lock();
               var done = function done() {
                 unlock();
               };

               var pageObject = _this11._pages.splice(index, 1)[0];
               pageObject.element.style.display = 'block';
               pageObject.element.setAttribute('_skipinit', '');

               if (options.animation) {
                 options.animator = _this11._animatorFactory.newAnimator(options);
               }

               pageObject.options = util.extend(pageObject.options, options);
               return _this11._pushPageDOM(pageObject, done);
             };

             return {
               v: new Promise(function (resolve) {
                 _this11._doorLock.waitUnlock(function () {
                   return resolve(tryBringPageTop());
                 });
               })
             };
           })();

           if ((typeof _ret2 === 'undefined' ? 'undefined' : babelHelpers.typeof(_ret2)) === "object") return _ret2.v;
         }
       }

       /**
        * @param {String} page
        * @return {Number} Returns the last index at which the given page
        * is found in the page-stack, or -1 if it is not present.
        */

     }, {
       key: '_lastIndexOfPage',
       value: function _lastIndexOfPage(page) {
         var index = undefined;
         for (index = this._pages.length - 1; index >= 0; index--) {
           if (this._pages[index].page === page) {
             break;
           }
         }
         return index;
       }

       /**
        * @return {Boolean} Whether if event is canceled.
        */

     }, {
       key: '_emitPrePushEvent',
       value: function _emitPrePushEvent() {
         var isCanceled = false;

         util.triggerElementEvent(this, 'prepush', {
           navigator: this,
           currentPage: this._pages.length > 0 ? this.getCurrentPage() : undefined,
           cancel: function cancel() {
             isCanceled = true;
           }
         });

         return isCanceled;
       }

       /**
        * @return {Boolean} Whether if event is canceled.
        */

     }, {
       key: '_emitPrePopEvent',
       value: function _emitPrePopEvent() {
         var isCanceled = false;

         var leavePage = this.getCurrentPage();
         util.triggerElementEvent(this, 'prepop', {
           navigator: this,
           // TODO: currentPage will be deprecated
           currentPage: leavePage,
           leavePage: leavePage,
           enterPage: this._pages[this._pages.length - 2],
           cancel: function cancel() {
             isCanceled = true;
           }
         });

         return isCanceled;
       }

       /**
        * @param {String} page
        * @param {Element} element
        * @param {Object} options
        */

     }, {
       key: '_createPageObject',
       value: function _createPageObject(page, element, options) {

         options.animator = this._animatorFactory.newAnimator(options);

         return new NavigatorPage({
           page: page,
           element: element,
           options: options,
           navigator: this
         });
       }
     }, {
       key: '_createPageElement',
       value: function _createPageElement(templateHTML) {
         var pageElement = util.createElement(internal.normalizePageHTML(templateHTML));

         if (pageElement.nodeName.toLowerCase() !== 'ons-page') {
           throw new Error('You must supply an "ons-page" element to "ons-navigator".');
         }

         return pageElement;
       }
     }, {
       key: 'options',
       get: function get() {
         return this._options;
       },
       set: function set(object) {
         this._options = object;
         if (!this._options.hasOwnProperty('cancelIfRunning')) {
           this._options.cancelIfRunning = true;
         }
       }
     }, {
       key: 'pages',
       get: function get() {
         return this._pages.slice(0);
       }
     }]);
     return NavigatorElement;
   })(BaseElement);

   window.OnsNavigatorElement = document.registerElement('ons-navigator', {
     prototype: NavigatorElement.prototype
   });

   /**
    * @param {String} name
    * @param {Function} Animator
    */
   window.OnsNavigatorElement.registerAnimator = function (name, Animator) {
     if (!(Animator.prototype instanceof NavigatorTransitionAnimator)) {
       throw new Error('"Animator" param must inherit OnsNavigatorElement.NavigatorTransitionAnimator');
     }

     _animatorDict$2[name] = Animator;
   };

   window.OnsNavigatorElement.rewritables = rewritables$2;
   window.OnsNavigatorElement.NavigatorTransitionAnimator = NavigatorTransitionAnimator;

   var scheme$10 = {
     '': 'page--*',
     '.page__content': 'page--*__content',
     '.page__background': 'page--*__background'
   };

   var nullToolbarElement = document.createElement('ons-toolbar');

   /**
    * @element ons-page
    * @category page
    * @description
    *   [en]Should be used as root component of each page. The content inside page component is scrollable.[/en]
    *   [ja]ページ定義のためのコンポーネントです。このコンポーネントの内容はスクロールが許可されます。[/ja]
    * @guide ManagingMultiplePages
    *   [en]Managing multiple pages[/en]
    *   [ja]複数のページを管理する[/ja]
    * @guide Pagelifecycle
    *   [en]Page life cycle events[/en]
    *   [ja]ページライフサイクルイベント[/ja]
    * @guide HandlingBackButton
    *   [en]Handling back button[/en]
    *   [ja]バックボタンに対応する[/ja]
    * @guide OverridingCSSstyles
    *   [en]Overriding CSS styles[/en]
    *   [ja]CSSスタイルのオーバーライド[/ja]
    * @guide DefiningMultiplePagesinSingleHTML
    *   [en]Defining multiple pages in single html[/en]
    *   [ja]複数のページを1つのHTMLに記述する[/ja]
    * @example
    * <ons-page>
    *   <ons-toolbar>
    *     <div class="center">Title</div>
    *   </ons-toolbar>
    *
    *   ...
    * </ons-page>
    */

   var PageElement = (function (_BaseElement) {
     babelHelpers.inherits(PageElement, _BaseElement);

     function PageElement() {
       babelHelpers.classCallCheck(this, PageElement);
       return babelHelpers.possibleConstructorReturn(this, Object.getPrototypeOf(PageElement).apply(this, arguments));
     }

     babelHelpers.createClass(PageElement, [{
       key: 'createdCallback',

       /**
        * @event init
        * @description
        *   [en]Fired right after the page is attached.[/en]
        *   [ja]ページがアタッチされた後に発火します。[/ja]
        * @param {Object} event [en]Event object.[/en]
        * @param {Object} event.page
        *   [en]Page object.[/en]
        *   [ja]ページのオブジェクト。[/ja]
        */

       /**
        * @event show
        * @description
        *   [en]Fired right after the page is shown.[/en]
        *   [ja]ページが表示された後に発火します。[/ja]
        * @param {Object} event [en]Event object.[/en]
        * @param {Object} event.page
        *   [en]Page object.[/en]
        *   [ja]ページのオブジェクト。[/ja]
        */

       /**
        * @event hide
        * @description
        *   [en]Fired right after the page is hidden.[/en]
        *   [ja]ページが隠れた後に発火します。[/ja]
        * @param {Object} event [en]Event object.[/en]
        * @param {Object} event.page
        *   [en]Page object.[/en]
        *   [ja]ページのオブジェクト。[/ja]
        */

       /**
        * @event destroy
        * @description
        *   [en]Fired right before the page is destroyed.[/en]
        *   [ja]ページが破棄される前に発火します。[/ja]
        * @param {Object} event [en]Event object.[/en]
        * @param {Object} event.page
        *   [en]Page object.[/en]
        *   [ja]ページのオブジェクト。[/ja]
        */

       /**
        * @attribute modifier
        * @type {String}
        * @description
        *   [en]Specify modifier name to specify custom styles.[/en]
        *   [ja]スタイル定義をカスタマイズするための名前を指定します。[/ja]
        */

       value: function createdCallback() {
         this.classList.add('page');

         if (!this.hasAttribute('_compiled')) {
           this._compile();
         }

         this._isShown = false;
         this._contentElement = this._getContentElement();
         this._isMuted = this.hasAttribute('_muted');
         this._skipInit = this.hasAttribute('_skipinit');
         this.eventDetail = {
           page: this
         };
       }
     }, {
       key: 'attachedCallback',
       value: function attachedCallback() {
         var _this2 = this;

         if (!this._isMuted) {
           if (this._skipInit) {
             this.removeAttribute('_skipinit');
           } else {
             util.triggerElementEvent(this, 'init', this.eventDetail);
           }
         }

         if (!util.hasAnyComponentAsParent(this)) {
           setImmediate(function () {
             return _this2._show();
           });
         }

         this._tryToFillStatusBar();
       }

       /**
        * @return {boolean}
        */

     }, {
       key: 'getDeviceBackButtonHandler',

       /**
        * @method getDeviceBackButtonHandler
        * @signature getDeviceBackButtonHandler()
        * @return {Object/null}
        *   [en]Device back button handler.[/en]
        *   [ja]デバイスのバックボタンハンドラを返します。[/ja]
        * @description
        *   [en]Get the associated back button handler. This method may return null if no handler is assigned.[/en]
        *   [ja]バックボタンハンドラを取得します。このメソッドはnullを返す場合があります。[/ja]
        */
       value: function getDeviceBackButtonHandler() {
         return this._deviceBackButtonHandler || null;
       }

       /**
        * @param {Function} callback
        */

     }, {
       key: 'setDeviceBackButtonHandler',
       value: function setDeviceBackButtonHandler(callback) {
         if (this._deviceBackButtonHandler) {
           this._deviceBackButtonHandler.destroy();
         }

         this._deviceBackButtonHandler = deviceBackButtonDispatcher.createHandler(this, callback);
       }

       /**
        * @return {HTMLElement}
        */

     }, {
       key: '_getContentElement',
       value: function _getContentElement() {
         var result = util.findChild(this, '.page__content');
         if (result) {
           return result;
         }
         throw Error('fail to get ".page__content" element.');
       }

       /**
        * @return {Boolean}
        */

     }, {
       key: '_hasToolbarElement',
       value: function _hasToolbarElement() {
         return !!util.findChild(this, 'ons-toolbar');
       }

       /**
        * @return {Boolean}
        */

     }, {
       key: '_canAnimateToolbar',
       value: function _canAnimateToolbar() {
         var toolbar = util.findChild(this, 'ons-toolbar');
         if (toolbar) {
           return true;
         }

         var elements = this._contentElement.children;
         for (var i = 0; i < elements.length; i++) {
           if (elements[i].nodeName.toLowerCase() === 'ons-toolbar' && !elements[i].hasAttribute('inline')) {
             return true;
           }
         }

         return false;
       }

       /**
        * @return {HTMLElement}
        */

     }, {
       key: '_getBackgroundElement',
       value: function _getBackgroundElement() {
         var result = util.findChild(this, '.page__background');
         if (result) {
           return result;
         }
         throw Error('fail to get ".page__background" element.');
       }

       /**
        * @return {HTMLElement}
        */

     }, {
       key: '_getBottomToolbarElement',
       value: function _getBottomToolbarElement() {
         return util.findChild(this, 'ons-bottom-toolbar') || internal.nullElement;
       }

       /**
        * @return {HTMLElement}
        */

     }, {
       key: '_getToolbarElement',
       value: function _getToolbarElement() {
         return util.findChild(this, 'ons-toolbar') || nullToolbarElement;
       }

       /**
        * Register toolbar element to this page.
        *
        * @param {HTMLElement} element
        */

     }, {
       key: '_registerToolbar',
       value: function _registerToolbar(element) {
         this._contentElement.setAttribute('no-status-bar-fill', '');

         if (util.findChild(this, '.page__status-bar-fill')) {
           this.insertBefore(element, this.children[1]);
         } else {
           this.insertBefore(element, this.children[0]);
         }
       }

       /**
        * Register toolbar element to this page.
        *
        * @param {HTMLElement} element
        */

     }, {
       key: '_registerBottomToolbar',
       value: function _registerBottomToolbar(element) {
         if (!util.findChild(this, '.page__status-bar-fill')) {
           var fill = document.createElement('div');
           fill.classList.add('page__bottom-bar-fill');
           fill.style.width = '0px';
           fill.style.height = '0px';

           this.insertBefore(fill, this.children[0]);
           this.insertBefore(element, null);
         }
       }
     }, {
       key: 'attributeChangedCallback',
       value: function attributeChangedCallback(name, last, current) {
         if (name === 'modifier') {
           return ModifierUtil.onModifierChanged(last, current, this, scheme$10);
         } else if (name === '_muted') {
           this._isMuted = this.hasAttribute('_muted');
         } else if (name === '_skipinit') {
           this._skipInit = this.hasAttribute('_skipinit');
         }
       }
     }, {
       key: '_compile',
       value: function _compile() {
         ons$1._autoStyle.prepare(this);

         var background = document.createElement('div');
         background.classList.add('page__background');

         var content = document.createElement('div');
         content.classList.add('page__content');

         while (this.childNodes[0]) {
           content.appendChild(this.childNodes[0]);
         }

         if (this.hasAttribute('style')) {
           background.setAttribute('style', this.getAttribute('style'));
           this.removeAttribute('style', null);
         }

         var fragment = document.createDocumentFragment();
         fragment.appendChild(background);
         fragment.appendChild(content);

         this.appendChild(fragment);

         ModifierUtil.initModifier(this, scheme$10);

         this.setAttribute('_compiled', '');
       }
     }, {
       key: '_registerExtraElement',
       value: function _registerExtraElement(element) {
         var extra = util.findChild(this, '.page__extra');
         if (!extra) {
           extra = document.createElement('div');
           extra.classList.add('page__extra');
           extra.style.zIndex = '10001';
           this.insertBefore(extra, null);
         }

         extra.insertBefore(element, null);
       }
     }, {
       key: '_tryToFillStatusBar',
       value: function _tryToFillStatusBar() {
         var _this3 = this;

         return internal.shouldFillStatusBar(this).then(function () {
           var fill = _this3.querySelector('.page__status-bar-fill');

           if (fill instanceof HTMLElement) {
             return fill;
           }

           fill = document.createElement('div');
           fill.classList.add('page__status-bar-fill');
           fill.style.width = '0px';
           fill.style.height = '0px';

           var bottomBarFill = undefined;

           for (var i = 0; i < _this3.children.length; i++) {
             if (_this3.children[i].classList.contains('page__bottom-bar-fill')) {
               bottomBarFill = _this3.children[i];
               break;
             }
           }

           if (bottomBarFill) {
             _this3.insertBefore(fill, bottomBarFill.nextSibling);
           } else {
             _this3.insertBefore(fill, _this3.children[0]);
           }

           return fill;
         }).catch(function () {
           var el = _this3.querySelector('.page__status-bar-fill');
           if (el instanceof HTMLElement) {
             el.remove();
           }
         });
       }
     }, {
       key: '_show',
       value: function _show() {
         if (!this.isShown && util.isAttached(this)) {
           this.isShown = true;

           if (!this._isMuted) {
             util.triggerElementEvent(this, 'show', this.eventDetail);
           }

           util.propagateAction(this._contentElement, '_show');
         }
       }
     }, {
       key: '_hide',
       value: function _hide() {
         if (this.isShown) {
           this.isShown = false;

           if (!this._isMuted) {
             util.triggerElementEvent(this, 'hide', this.eventDetail);
           }

           util.propagateAction(this._contentElement, '_hide');
         }
       }
     }, {
       key: '_destroy',
       value: function _destroy() {
         this._hide();

         if (!this._isMuted) {
           util.triggerElementEvent(this, 'destroy', this.eventDetail);
         }

         if (this.getDeviceBackButtonHandler()) {
           this.getDeviceBackButtonHandler().destroy();
         }

         util.propagateAction(this._contentElement, '_destroy');

         this.remove();
       }
     }, {
       key: 'isShown',
       get: function get() {
         return this._isShown;
       }

       /**
        * @param {boolean}
        */
       ,
       set: function set(value) {
         this._isShown = value;
       }
     }]);
     return PageElement;
   })(BaseElement);

   window.OnsPageElement = document.registerElement('ons-page', {
     prototype: PageElement.prototype
   });

   /*
   Copyright 2013-2015 ASIAL CORPORATION

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.

   */

   var PopoverAnimator = (function () {

     /**
      * @param {Object} options
      * @param {String} options.timing
      * @param {Number} options.duration
      * @param {Number} options.delay
      */

     function PopoverAnimator(options) {
       babelHelpers.classCallCheck(this, PopoverAnimator);

       options = ons._util.extend({
         timing: 'cubic-bezier(.1, .7, .4, 1)',
         duration: 0.2,
         delay: 0
       }, options || {});

       this.timing = options.timing;
       this.duration = options.duration;
       this.delay = options.delay;
     }

     babelHelpers.createClass(PopoverAnimator, [{
       key: 'show',
       value: function show(popover, callback) {
         callback();
       }
     }, {
       key: 'hide',
       value: function hide(popover, callback) {
         callback();
       }
     }]);
     return PopoverAnimator;
   })();

   var FadePopoverAnimator = (function (_PopoverAnimator) {
     babelHelpers.inherits(FadePopoverAnimator, _PopoverAnimator);

     function FadePopoverAnimator(options) {
       babelHelpers.classCallCheck(this, FadePopoverAnimator);
       return babelHelpers.possibleConstructorReturn(this, Object.getPrototypeOf(FadePopoverAnimator).call(this, options));
     }

     /**
     * @param {Object} popover
     * @param {Function} callback
     */

     babelHelpers.createClass(FadePopoverAnimator, [{
       key: 'show',
       value: function show(popover, callback) {
         var pop = popover.querySelector('.popover');
         var mask = popover.querySelector('.popover-mask');

         animit.runAll(animit(mask).queue({
           opacity: 0
         }).wait(this.delay).queue({
           opacity: 1.0
         }, {
           duration: this.duration,
           timing: this.timing
         }), animit(pop).saveStyle().queue({
           transform: 'scale3d(1.3, 1.3, 1.0)',
           opacity: 0
         }).wait(this.delay).queue({
           transform: 'scale3d(1.0, 1.0,  1.0)',
           opacity: 1.0
         }, {
           duration: this.duration,
           timing: this.timing
         }).restoreStyle().queue(function (done) {
           callback();
           done();
         }));
       }

       /**
       * @param {Object} popover
       * @param {Function} callback
       */

     }, {
       key: 'hide',
       value: function hide(popover, callback) {
         var pop = popover.querySelector('.popover');
         var mask = popover.querySelector('.popover-mask');

         animit.runAll(animit(mask).queue({
           opacity: 1.0
         }).wait(this.delay).queue({
           opacity: 0
         }, {
           duration: this.duration,
           timing: this.timing
         }), animit(pop).saveStyle().queue({
           opacity: 1.0
         }).wait(this.delay).queue({
           opacity: 0
         }, {
           duration: this.duration,
           timing: this.timing
         }).restoreStyle().queue(function (done) {
           callback();
           done();
         }));
       }
     }]);
     return FadePopoverAnimator;
   })(PopoverAnimator);

   var scheme$23 = {
     '.popover': 'popover--*',
     '.popover__content': 'popover__content--*'
   };

   var templateSource$3 = util.createElement('\n  <div>\n    <div class="popover-mask"></div>\n    <div class="popover">\n      <div class="popover__content"></div>\n      <div class="popover__arrow"></div>\n    </div>\n  </div>\n');

   var _animatorDict$4 = {
     'fade': FadePopoverAnimator,
     'none': PopoverAnimator
   };

   /**
    * @element ons-popover
    * @category popover
    * @description
    *  [en]A component that displays a popover next to an element.[/en]
    *  [ja]ある要素を対象とするポップオーバーを表示するコンポーネントです。[/ja]
    * @codepen ZYYRKo
    * @example
    * <script>
    * ons.ready(function() {
    *   ons.createPopover('popover.html').then(function(popover) {
    *     popover.show('#mybutton');
    *   });
    * });
    * </script>
    *
    * <script type="text/ons-template" id="popover.html">
    *   <ons-popover cancelable>
    *     <p style="text-align: center; opacity: 0.5;">This popover will choose which side it's displayed on automatically.</p>
    *   </ons-popover>
    * </script>
    */

   var PopoverElement = (function (_BaseElement) {
     babelHelpers.inherits(PopoverElement, _BaseElement);

     function PopoverElement() {
       babelHelpers.classCallCheck(this, PopoverElement);
       return babelHelpers.possibleConstructorReturn(this, Object.getPrototypeOf(PopoverElement).apply(this, arguments));
     }

     babelHelpers.createClass(PopoverElement, [{
       key: 'createdCallback',
       value: function createdCallback() {
         if (!this.hasAttribute('_compiled')) {
           this._compile();
         }

         this._visible = false;
         this._doorLock = new DoorLock();
         this._boundOnChange = this._onChange.bind(this);
         this._boundCancel = this._cancel.bind(this);

         this._animatorFactory = this._createAnimatorFactory();
       }
     }, {
       key: '_createAnimatorFactory',
       value: function _createAnimatorFactory() {
         return new AnimatorFactory({
           animators: _animatorDict$4,
           baseClass: PopoverAnimator,
           baseClassName: 'PopoverAnimator',
           defaultAnimation: this.getAttribute('animation') || 'fade'
         });
       }
     }, {
       key: '_onDeviceBackButton',
       value: function _onDeviceBackButton(event) {
         if (this.isCancelable()) {
           this._cancel();
         } else {
           event.callParentHandler();
         }
       }
     }, {
       key: '_setDirection',
       value: function _setDirection(direction) {
         var arrowPosition = undefined;
         if (direction === 'up') {
           arrowPosition = 'bottom';
         } else if (direction === 'left') {
           arrowPosition = 'right';
         } else if (direction === 'down') {
           arrowPosition = 'top';
         } else if (direction == 'right') {
           arrowPosition = 'left';
         } else {
           throw new Error('Invalid direction.');
         }

         var popoverClassList = this._popover.classList;
         popoverClassList.remove('popover--up');
         popoverClassList.remove('popover--down');
         popoverClassList.remove('popover--left');
         popoverClassList.remove('popover--right');
         popoverClassList.add('popover--' + direction);

         var arrowClassList = this._arrow.classList;
         arrowClassList.remove('popover__top-arrow');
         arrowClassList.remove('popover__bottom-arrow');
         arrowClassList.remove('popover__left-arrow');
         arrowClassList.remove('popover__right-arrow');
         arrowClassList.add('popover__' + arrowPosition + '-arrow');
       }
     }, {
       key: '_positionPopoverByDirection',
       value: function _positionPopoverByDirection(target, direction) {
         var el = this._popover;
         var pos = target.getBoundingClientRect();
         var own = el.getBoundingClientRect();
         var arrow = el.children[1];
         var offset = 14;
         var margin = 6;
         var radius = parseInt(window.getComputedStyle(el.querySelector('.popover__content')).borderRadius);

         arrow.style.top = '';
         arrow.style.left = '';

         this._setDirection(direction);

         // Position popover next to the target.
         if (['left', 'right'].indexOf(direction) > -1) {
           if (direction == 'left') {
             el.style.left = pos.right - pos.width - own.width - offset + 'px';
           } else {
             el.style.left = pos.right + offset + 'px';
           }
           el.style.top = pos.bottom - pos.height / 2 - own.height / 2 + 'px';
         } else {
           if (direction == 'up') {
             el.style.top = pos.bottom - pos.height - own.height - offset + 'px';
           } else {
             el.style.top = pos.bottom + offset + 'px';
           }
           el.style.left = pos.right - pos.width / 2 - own.width / 2 + 'px';
         }

         own = el.getBoundingClientRect();

         // This is the difference between the side and the hypothenuse of the arrow.
         var diff = (function (x) {
           return x / 2 * Math.sqrt(2) - x / 2;
         })(parseInt(window.getComputedStyle(arrow).width));

         // This is the limit for the arrow. If it's moved further than this it's outside the popover.
         var limit = margin + radius + diff + 2;

         // Keep popover inside window and arrow inside popover.
         if (['left', 'right'].indexOf(direction) > -1) {
           if (own.top < margin) {
             arrow.style.top = Math.max(own.height / 2 + own.top - margin, limit) + 'px';
             el.style.top = margin + 'px';
           } else if (own.bottom > window.innerHeight - margin) {
             arrow.style.top = Math.min(own.height / 2 - (window.innerHeight - own.bottom) + margin, own.height - limit) + 'px';
             el.style.top = window.innerHeight - own.height - margin + 'px';
           }
         } else {
           if (own.left < margin) {
             arrow.style.left = Math.max(own.width / 2 + own.left - margin, limit) + 'px';
             el.style.left = margin + 'px';
           } else if (own.right > window.innerWidth - margin) {
             arrow.style.left = Math.min(own.width / 2 - (window.innerWidth - own.right) + margin, own.width - limit) + 'px';
             el.style.left = window.innerWidth - own.width - margin + 'px';
           }
         }

         // Prevent animit from restoring the style.
         el.removeAttribute('data-animit-orig-style');
       }
     }, {
       key: '_positionPopover',
       value: function _positionPopover(target) {
         var _this2 = this;

         var directions = (function () {
           if (!_this2.hasAttribute('direction')) {
             return ['up', 'down', 'left', 'right'];
           } else {
             return _this2.getAttribute('direction').split(/\s+/);
           }
         })();

         var position = target.getBoundingClientRect();

         // The popover should be placed on the side with the most space.
         var scores = {
           left: position.left,
           right: window.innerWidth - position.right,
           up: position.top,
           down: window.innerHeight - position.bottom
         };

         var orderedDirections = Object.keys(scores).sort(function (a, b) {
           return -(scores[a] - scores[b]);
         });
         for (var i = 0, l = orderedDirections.length; i < l; i++) {
           var direction = orderedDirections[i];
           if (directions.indexOf(direction) > -1) {
             this._positionPopoverByDirection(target, direction);
             return;
           }
         }
       }
     }, {
       key: '_onChange',
       value: function _onChange() {
         var _this3 = this;

         setImmediate(function () {
           if (_this3._currentTarget) {
             _this3._positionPopover(_this3._currentTarget);
           }
         });
       }
     }, {
       key: '_compile',
       value: function _compile() {
         ons._autoStyle.prepare(this);

         var templateElement = templateSource$3.cloneNode(true);
         var content = templateElement.querySelector('.popover__content');
         var style = this.getAttribute('style');

         if (style) {
           this.removeAttribute('style');
         }

         while (this.childNodes[0]) {
           content.appendChild(this.childNodes[0]);
         }

         while (templateElement.children[0]) {
           this.appendChild(templateElement.children[0]);
         }

         if (style) {
           this._popover.setAttribute('style', style);
         }

         this.style.display = 'none';

         this._mask.style.zIndex = '20000';
         this._popover.style.zIndex = '20001';

         if (this.hasAttribute('mask-color')) {
           this._mask.style.backgroundColor = this.getAttribute('mask-color');
         }

         ModifierUtil.initModifier(this, scheme$23);

         this.setAttribute('_compiled', '');
       }

       /**
        * @method show
        * @signature show(target, [options])
        * @param {String|Event|HTMLElement} target
        *   [en]Target element. Can be either a CSS selector, an event object or a DOM element.[/en]
        *   [ja]ポップオーバーのターゲットとなる要素を指定します。CSSセレクタかeventオブジェクトかDOM要素のいずれかを渡せます。[/ja]
        * @param {Object} [options]
        *   [en]Parameter object.[/en]
        *   [ja]オプションを指定するオブジェクト。[/ja]
        * @param {String} [options.animation]
        *   [en]Animation name. Available animations are "fade" and "none".[/en]
        *   [ja]アニメーション名を指定します。"fade"もしくは"none"を指定できます。[/ja]
        * @param {String} [options.animationOptions]
        *   [en]Specify the animation's duration, delay and timing. E.g.  <code>{duration: 0.2, delay: 0.4, timing: 'ease-in'}</code>[/en]
        *   [ja]アニメーション時のduration, delay, timingを指定します。e.g. <code>{duration: 0.2, delay: 0.4, timing: 'ease-in'}</code> [/ja]
        * @param {Function} [options.callback]
        *   [en]This function is called after the popover has been revealed.[/en]
        *   [ja]ポップオーバーが表示され終わった後に呼び出される関数オブジェクトを指定します。[/ja]
        * @description
        *   [en]Open the popover and point it at a target. The target can be either an event, a css selector or a DOM element..[/en]
        *   [ja]対象とする要素にポップオーバーを表示します。target引数には、$eventオブジェクトやDOMエレメントやCSSセレクタを渡すことが出来ます。[/ja]
        * @return {Promise}
        *   [en]Resolves to the displayed element[/en]
        *   [ja][/ja]
        */

     }, {
       key: 'show',
       value: function show(target) {
         var _this4 = this;

         var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

         var callback = options.callback || function () {};

         if (typeof target === 'string') {
           target = document.querySelector(target);
         } else if (target instanceof Event) {
           target = target.target;
         }

         if (!target) {
           throw new Error('Target undefined');
         }

         options.animationOptions = util.extend(options.animationOptions || {}, AnimatorFactory.parseAnimationOptionsString(this.getAttribute('animation-options')));

         if (options.animation && !(options.animation in _animatorDict$4)) {
           throw new Error('Animator ' + options.animation + ' is not registered.');
         }

         var canceled = false;
         util.triggerElementEvent(this, 'preshow', {
           popover: this,
           cancel: function cancel() {
             canceled = true;
           }
         });

         if (!canceled) {
           var _ret = (function () {
             var tryShow = function tryShow() {
               var unlock = _this4._doorLock.lock();
               var animator = _this4._animatorFactory.newAnimator(options);

               _this4.style.display = 'block';

               _this4._currentTarget = target;
               _this4._positionPopover(target);

               return new Promise(function (resolve) {
                 animator.show(_this4, function () {
                   _this4._visible = true;
                   unlock();

                   util.triggerElementEvent(_this4, 'postshow', { popover: _this4 });

                   callback();
                   resolve(_this4);
                 });
               });
             };

             return {
               v: new Promise(function (resolve) {
                 _this4._doorLock.waitUnlock(function () {
                   return resolve(tryShow());
                 });
               })
             };
           })();

           if ((typeof _ret === 'undefined' ? 'undefined' : babelHelpers.typeof(_ret)) === "object") return _ret.v;
         } else {
           return Promise.reject('Canceled in preshow event.');
         }
       }

       /**
        * @method hide
        * @signature hide([options])
        * @param {Object} [options]
        *   [en]Parameter object.[/en]
        *   [ja]オプションを指定するオブジェクト。[/ja]
        * @param {String} [options.animation]
        *   [en]Animation name. Available animations are "fade" and "none".[/en]
        *   [ja]アニメーション名を指定します。"fade"もしくは"none"を指定できます。[/ja]
        * @param {String} [options.animationOptions]
        *   [en]Specify the animation's duration, delay and timing. E.g.  <code>{duration: 0.2, delay: 0.4, timing: 'ease-in'}</code>[/en]
        *   [ja]アニメーション時のduration, delay, timingを指定します。e.g. <code>{duration: 0.2, delay: 0.4, timing: 'ease-in'}</code> [/ja]
        * @param {Function} [options.callback]
        *   [en]This functions is called after the popover has been hidden.[/en]
        *   [ja]ポップオーバーが隠れた後に呼び出される関数オブジェクトを指定します。[/ja]
        * @description
        *   [en]Close the popover.[/en]
        *   [ja]ポップオーバーを閉じます。[/ja]
        * @return {Promise}
        *   [en]Resolves to the hidden element[/en]
        *   [ja][/ja]
        */

     }, {
       key: 'hide',
       value: function hide() {
         var _this5 = this;

         var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

         var callback = options.callback || function () {};

         options.animationOptions = util.extend(options.animationOptions || {}, AnimatorFactory.parseAnimationOptionsString(this.getAttribute('animation-options')));

         if (options.animation && !(options.animation in _animatorDict$4)) {
           throw new Error('Animator ' + options.animation + ' is not registered.');
         }

         var canceled = false;
         util.triggerElementEvent(this, 'prehide', {
           popover: this,
           cancel: function cancel() {
             canceled = true;
           }
         });

         if (!canceled) {
           var _ret2 = (function () {
             var tryHide = function tryHide() {
               var unlock = _this5._doorLock.lock();
               var animator = _this5._animatorFactory.newAnimator(options);

               return new Promise(function (resolve) {
                 animator.hide(_this5, function () {
                   _this5.style.display = 'none';
                   _this5._visible = false;
                   unlock();

                   util.triggerElementEvent(_this5, 'posthide', { popover: _this5 });

                   callback();
                   resolve(_this5);
                 });
               });
             };

             return {
               v: new Promise(function (resolve) {
                 _this5._doorLock.waitUnlock(function () {
                   return resolve(tryHide());
                 });
               })
             };
           })();

           if ((typeof _ret2 === 'undefined' ? 'undefined' : babelHelpers.typeof(_ret2)) === "object") return _ret2.v;
         } else {
           return Promise.reject('Canceled in prehide event.');
         }
       }

       /**
        * @method isShown
        * @signature isShown()
        * @return {Boolean}
        *   [en]true if the popover is visible.[/en]
        *   [ja]ポップオーバーが表示されている場合にtrueとなります。[/ja]
        * @description
        *   [en]Returns whether the popover is visible or not.[/en]
        *   [ja]ポップオーバーが表示されているかどうかを返します。[/ja]
        */

     }, {
       key: 'isShown',
       value: function isShown() {
         return this._visible;
       }
     }, {
       key: 'attachedCallback',
       value: function attachedCallback() {
         this._mask.addEventListener('click', this._boundCancel, false);

         this._deviceBackButtonHandler = deviceBackButtonDispatcher.createHandler(this, this._onDeviceBackButton.bind(this));

         this._popover.addEventListener('DOMNodeInserted', this._boundOnChange, false);
         this._popover.addEventListener('DOMNodeRemoved', this._boundOnChange, false);

         window.addEventListener('resize', this._boundOnChange, false);
       }
     }, {
       key: 'detachedCallback',
       value: function detachedCallback() {
         this._mask.removeEventListener('click', this._boundCancel, false);

         this._deviceBackButtonHandler.destroy();
         this._deviceBackButtonHandler = null;

         this._popover.removeEventListener('DOMNodeInserted', this._boundOnChange, false);
         this._popover.removeEventListener('DOMNodeRemoved', this._boundOnChange, false);

         window.removeEventListener('resize', this._boundOnChange, false);
       }
     }, {
       key: 'attributeChangedCallback',
       value: function attributeChangedCallback(name, last, current) {
         if (name === 'modifier') {
           return ModifierUtil.onModifierChanged(last, current, this, scheme$23);
         } else if (name === 'direction') {
           this._boundOnChange();
         } else if (name === 'animation' || name === 'animation-options') {
           this._animatorFactory = this._createAnimatorFactory();
         }
       }

       /**
        * @method setCancelable
        * @signature setCancelable(cancelable)
        * @param {Boolean} cancelable
        *   [en]If true the popover will be cancelable.[/en]
        *   [ja]ポップオーバーがキャンセル可能にしたい場合にtrueを指定します。[/ja]
        * @description
        *   [en]Set whether the popover can be canceled by the user when it is shown.[/en]
        *   [ja]ポップオーバーを表示した際に、ユーザがそのポップオーバーをキャンセルできるかどうかを指定します。[/ja]
        */

     }, {
       key: 'setCancelable',
       value: function setCancelable(cancelable) {
         if (typeof cancelable !== 'boolean') {
           throw new Error('Argument must be a boolean.');
         }

         if (cancelable) {
           this.setAttribute('cancelable', '');
         } else {
           this.removeAttribute('cancelable');
         }
       }

       /**
        * @method isCancelable
        * @signature isCancelable()
        * @return {Boolean}
        *   [en]true if the popover is cancelable.[/en]
        *   [ja]ポップオーバーがキャンセル可能であればtrueとなります。[/ja]
        * @description
        *   [en]Returns whether the popover is cancelable or not.[/en]
        *   [ja]このポップオーバーがキャンセル可能かどうかを返します。[/ja]
        */

     }, {
       key: 'isCancelable',
       value: function isCancelable() {
         return this.hasAttribute('cancelable');
       }

       /**
        * @method destroy
        * @signature destroy()
        * @description
        *   [en]Destroy the popover and remove it from the DOM tree.[/en]
        *   [ja]ポップオーバーを破棄して、DOMツリーから取り除きます。[/ja]
        */

     }, {
       key: 'destroy',
       value: function destroy() {
         if (this.parentElement) {
           this.parentElement.removeChild(this);
         }
       }
     }, {
       key: '_cancel',
       value: function _cancel() {
         var _this6 = this;

         if (this.isCancelable()) {
           this.hide({
             callback: function callback() {
               util.triggerElementEvent(_this6, 'cancel');
             }
           });
         }
       }
     }, {
       key: '_mask',

       /**
        * @event preshow
        * @description
        *   [en]Fired just before the popover is displayed.[/en]
        *   [ja]ポップオーバーが表示される直前に発火します。[/ja]
        * @param {Object} event [en]Event object.[/en]
        * @param {Object} event.popover
        *   [en]Component object.[/en]
        *   [ja]コンポーネントのオブジェクト。[/ja]
        * @param {Function} event.cancel
        *   [en]Call this function to stop the popover from being shown.[/en]
        *   [ja]この関数を呼び出すと、ポップオーバーの表示がキャンセルされます。[/ja]
        */

       /**
        * @event postshow
        * @description
        *   [en]Fired just after the popover is displayed.[/en]
        *   [ja]ポップオーバーが表示された直後に発火します。[/ja]
        * @param {Object} event [en]Event object.[/en]
        * @param {Object} event.popover
        *   [en]Component object.[/en]
        *   [ja]コンポーネントのオブジェクト。[/ja]
        */

       /**
        * @event prehide
        * @description
        *   [en]Fired just before the popover is hidden.[/en]
        *   [ja]ポップオーバーが隠れる直前に発火します。[/ja]
        * @param {Object} event [en]Event object.[/en]
        * @param {Object} event.popover
        *   [en]Component object.[/en]
        *   [ja]コンポーネントのオブジェクト。[/ja]
        * @param {Function} event.cancel
        *   [en]Call this function to stop the popover from being hidden.[/en]
        *   [ja]この関数を呼び出すと、ポップオーバーが隠れる処理をキャンセルします。[/ja]
        */

       /**
        * @event posthide
        * @description
        *   [en]Fired just after the popover is hidden.[/en]
        *   [ja]ポップオーバーが隠れた後に発火します。[/ja]
        * @param {Object} event [en]Event object.[/en]
        * @param {Object} event.popover
        *   [en]Component object.[/en]
        *   [ja]コンポーネントのオブジェクト。[/ja]
        */

       /**
        * @attribute modifier
        * @type {String}
        * @description
        *  [en]The appearance of the popover.[/en]
        *  [ja]ポップオーバーの表現を指定します。[/ja]
        */

       /**
        * @attribute direction
        * @type {String}
        * @description
        *  [en]
        *    A space separated list of directions. If more than one direction is specified,
        *    it will be chosen automatically. Valid directions are "up", "down", "left" and "right".
        *  [/en]
        *  [ja]
        *    ポップオーバーを表示する方向を空白区切りで複数指定できます。
        *    指定できる方向は、"up", "down", "left", "right"の4つです。空白区切りで複数指定することもできます。
        *    複数指定された場合、対象とする要素に合わせて指定した値から自動的に選択されます。
        *  [/ja]
        */

       /**
        * @attribute cancelable
        * @description
        *   [en]If this attribute is set the popover can be closed by tapping the background or by pressing the back button.[/en]
        *   [ja]この属性があると、ポップオーバーが表示された時に、背景やバックボタンをタップした時にをポップオーバー閉じます。[/ja]
        */

       /**
        * @attribute animation
        * @type {String}
        * @description
        *   [en]The animation used when showing an hiding the popover. Can be either "none" or "fade".[/en]
        *   [ja]ポップオーバーを表示する際のアニメーション名を指定します。[/ja]
        */

       /**
        * @attribute animation-options
        * @type {Expression}
        * @description
        *  [en]Specify the animation's duration, timing and delay with an object literal. E.g. <code>{duration: 0.2, delay: 1, timing: 'ease-in'}</code>[/en]
        *  [ja]アニメーション時のduration, timing, delayをオブジェクトリテラルで指定します。e.g. <code>{duration: 0.2, delay: 1, timing: 'ease-in'}</code>[/ja]
        */

       /**
        * @attribute mask-color
        * @type {Color}
        * @description
        *   [en]Color of the background mask. Default is "rgba(0, 0, 0, 0.2)".[/en]
        *   [ja]背景のマスクの色を指定します。デフォルトは"rgba(0, 0, 0, 0.2)"です。[/ja]
        */

       get: function get() {
         return this.children[0];
       }
     }, {
       key: '_popover',
       get: function get() {
         return this.children[1];
       }
     }, {
       key: '_content',
       get: function get() {
         return this._popover.children[0];
       }
     }, {
       key: '_arrow',
       get: function get() {
         return this._popover.children[1];
       }
     }]);
     return PopoverElement;
   })(BaseElement);

   window.OnsPopoverElement = document.registerElement('ons-popover', {
     prototype: PopoverElement.prototype
   });

   /**
    * @param {String} name
    * @param {PopoverAnimator} Animator
    */
   window.OnsPopoverElement.registerAnimator = function (name, Animator) {
     if (!(Animator.prototype instanceof PopoverAnimator)) {
       throw new Error('"Animator" param must inherit PopoverAnimator');
     }
     _animatorDict$4[name] = Animator;
   };

   window.OnsPopoverElement.PopoverAnimator = PopoverAnimator;

   var scheme$11 = {
     '.progress-bar': 'progress-bar--*',
     '.progress-bar__primary': 'progress-bar__primary--*',
     '.progress-bar__secondary': 'progress-bar__secondary--*'
   };

   var template = util.createElement('\n  <div class="progress-bar">\n    <div class="progress-bar__secondary"></div>\n    <div class="progress-bar__primary"></div>\n  </div>\n');

   /**
    * @element ons-progress-bar
    * @category progress
    * @description
    *   [en]A material design progress component. It's displayed as a linear progress indicator.[/en]
    *   [ja]マテリアルデザインのprogressコンポーネントです。linearなプログレスインジケータを表示します。[/ja]
    * @codepen zvQbGj
    * @example
    * <ons-progress-bar
    *  value="55"
    *  secondary-value="87">
    * </ons-progress-bar>
    */

   var ProgressBarElement = (function (_BaseElement) {
     babelHelpers.inherits(ProgressBarElement, _BaseElement);

     function ProgressBarElement() {
       babelHelpers.classCallCheck(this, ProgressBarElement);
       return babelHelpers.possibleConstructorReturn(this, Object.getPrototypeOf(ProgressBarElement).apply(this, arguments));
     }

     babelHelpers.createClass(ProgressBarElement, [{
       key: 'createdCallback',

       /**
        * @attribute modifier
        * @type {String}
        * @description
        *   [en]Change the appearance of the progress indicator.[/en]
        *   [ja]プログレスインジケータの見た目を変更します。[/ja]
        */

       /**
        * @attribute value
        * @type {Number}
        * @description
        *   [en]Current progress. Should be a value between 0 and 100.[/en]
        *   [ja]現在の進行状況の値を指定します。0から100の間の値を指定して下さい。[/ja]
        */

       /**
        * @attribute secondary-value
        * @type {Number}
        * @description
        *   [en]Current secondary progress. Should be a value between 0 and 100.[/en]
        *   [ja]現在の２番目の進行状況の値を指定します。0から100の間の値を指定して下さい。[/ja]
        */

       /**
        * @attribute indeterminate
        * @description
        *   [en]If this attribute is set, an infinite looping animation will be shown.[/en]
        *   [ja]この属性が設定された場合、ループするアニメーションが表示されます。[/ja]
        */

       value: function createdCallback() {
         if (!this.hasAttribute('_compiled')) {
           this._compile();
         }
       }
     }, {
       key: 'attributeChangedCallback',
       value: function attributeChangedCallback(name, last, current) {
         if (name === 'modifier') {
           return ModifierUtil.onModifierChanged(last, current, this, scheme$11);
         } else if (name === 'value' || name === 'secondary-value') {
           this._updateValue();
         } else if (name === 'indeterminate') {
           this._updateDeterminate();
         }
       }
     }, {
       key: '_updateDeterminate',
       value: function _updateDeterminate() {
         if (this.hasAttribute('indeterminate')) {
           this._template.classList.add('progress-bar--indeterminate');
           this._template.classList.remove('progress-bar--determinate');
         } else {
           this._template.classList.add('progress-bar--determinate');
           this._template.classList.remove('progress-bar--indeterminate');
         }
       }
     }, {
       key: '_updateValue',
       value: function _updateValue() {
         this._primary.style.width = this.hasAttribute('value') ? this.getAttribute('value') + '%' : '0%';
         this._secondary.style.width = this.hasAttribute('secondary-value') ? this.getAttribute('secondary-value') + '%' : '0%';
       }
     }, {
       key: '_compile',
       value: function _compile() {
         this._template = template.cloneNode(true);

         this._primary = this._template.childNodes[3];
         this._secondary = this._template.childNodes[1];

         this._updateDeterminate();
         this._updateValue();

         this.appendChild(this._template);

         ModifierUtil.initModifier(this, scheme$11);

         this.setAttribute('_compiled', '');
       }
     }]);
     return ProgressBarElement;
   })(BaseElement);

   window.OnsProgressBarElement = document.registerElement('ons-progress-bar', {
     prototype: ProgressBarElement.prototype
   });

   var scheme$12 = {
     '.progress-circular': 'progress-circular--*',
     '.progress-circular__primary': 'progress-circular__primary--*',
     '.progress-circular__secondary': 'progress-circular__secondary--*'
   };

   var template$1 = util.createElement('\n  <svg class="progress-circular">\n    <circle class="progress-circular__secondary" cx="50%" cy="50%" r="40%" fill="none" stroke-width="10%" stroke-miterlimit="10"/>\n    <circle class="progress-circular__primary" cx="50%" cy="50%" r="40%" fill="none" stroke-width="10%" stroke-miterlimit="10"/>\n  </svg>\n');

   /**
    * @element ons-progress-circular
    * @category progress
    * @description
    *   [en]A material design progress component. It's displayed as a circular progress indicator.[/en]
    *   [ja]マテリアルデザインのprogressコンポーネントです。circularなプログレスインジケータを表示します。[/ja]
    * @codepen EVzMjR
    * @example
    * <ons-progress-circular
    *  value="55"
    *  secondary-value="87">
    * </ons-progress-circular>
    */

   var ProgressCircularElement = (function (_BaseElement) {
     babelHelpers.inherits(ProgressCircularElement, _BaseElement);

     function ProgressCircularElement() {
       babelHelpers.classCallCheck(this, ProgressCircularElement);
       return babelHelpers.possibleConstructorReturn(this, Object.getPrototypeOf(ProgressCircularElement).apply(this, arguments));
     }

     babelHelpers.createClass(ProgressCircularElement, [{
       key: 'createdCallback',

       /**
        * @attribute modifier
        * @type {String}
        * @description
        *   [en]Change the appearance of the progress indicator.[/en]
        *   [ja]プログレスインジケータの見た目を変更します。[/ja]
        */

       /**
        * @attribute value
        * @type {Number}
        * @description
        *   [en]Current progress. Should be a value between 0 and 100.[/en]
        *   [ja]現在の進行状況の値を指定します。0から100の間の値を指定して下さい。[/ja]
        */

       /**
        * @attribute secondary-value
        * @type {Number}
        * @description
        *   [en]Current secondary progress. Should be a value between 0 and 100.[/en]
        *   [ja]現在の２番目の進行状況の値を指定します。0から100の間の値を指定して下さい。[/ja]
        */

       /**
        * @attribute indeterminate
        * @description
        *   [en]If this attribute is set, an infinite looping animation will be shown.[/en]
        *   [ja]この属性が設定された場合、ループするアニメーションが表示されます。[/ja]
        */

       value: function createdCallback() {
         if (!this.hasAttribute('_compiled')) {
           this._compile();
         }
       }
     }, {
       key: 'attributeChangedCallback',
       value: function attributeChangedCallback(name, last, current) {
         if (name === 'modifier') {
           return ModifierUtil.onModifierChanged(last, current, this, scheme$12);
         } else if (name === 'value' || name === 'secondary-value') {
           this._updateValue();
         } else if (name === 'indeterminate') {
           this._updateDeterminate();
         }
       }
     }, {
       key: '_updateDeterminate',
       value: function _updateDeterminate() {
         if (this.hasAttribute('indeterminate')) {
           this._template.classList.add('progress-circular--indeterminate');
           this._template.classList.remove('progress-circular--determinate');
         } else {
           this._template.classList.add('progress-circular--determinate');
           this._template.classList.remove('progress-circular--indeterminate');
         }
       }
     }, {
       key: '_updateValue',
       value: function _updateValue() {
         if (this.hasAttribute('value')) {
           var per = Math.ceil(this.getAttribute('value') * 251.32 * 0.01);
           this._primary.style['stroke-dasharray'] = per + '%, 251.32%';
         }
         if (this.hasAttribute('secondary-value')) {
           var per = Math.ceil(this.getAttribute('secondary-value') * 251.32 * 0.01);
           this._secondary.style['stroke-dasharray'] = per + '%, 251.32%';
         }
       }
     }, {
       key: '_compile',
       value: function _compile() {
         this._template = template$1.cloneNode(true);

         this._primary = this._template.childNodes[3];
         this._secondary = this._template.childNodes[1];

         this._updateDeterminate();
         this._updateValue();

         this.appendChild(this._template);

         ModifierUtil.initModifier(this, scheme$12);

         this.setAttribute('_compiled', '');
       }
     }]);
     return ProgressCircularElement;
   })(BaseElement);

   window.OnsProgressCircularElement = document.registerElement('ons-progress-circular', {
     prototype: ProgressCircularElement.prototype
   });

   var STATE_INITIAL = 'initial';
   var STATE_PREACTION = 'preaction';
   var STATE_ACTION = 'action';

   /**
    * @element ons-pull-hook
    * @category control
    * @description
    *   [en]Component that adds "pull-to-refresh" to an <ons-page> element.[/en]
    *   [ja]ons-page要素以下でいわゆるpull to refreshを実装するためのコンポーネントです。[/ja]
    * @codepen WbJogM
    * @guide UsingPullHook
    *   [en]How to use Pull Hook[/en]
    *   [ja]プルフックを使う[/ja]
    * @example
    * <ons-page>
    *   <ons-pull-hook>
    *     Release to refresh
    *   </ons-pull-hook>
    * </ons-page>
    *
    * <script>
    *   var loadStuff = function(done) {
    *     setTimeout(done, 1000);
    *   };
    *
    *   document.querySelector('ons-pull-hook').setActionCallback(loadStuff);
    * </script>
    */

   var PullHookElement = (function (_BaseElement) {
     babelHelpers.inherits(PullHookElement, _BaseElement);

     function PullHookElement() {
       babelHelpers.classCallCheck(this, PullHookElement);
       return babelHelpers.possibleConstructorReturn(this, Object.getPrototypeOf(PullHookElement).apply(this, arguments));
     }

     babelHelpers.createClass(PullHookElement, [{
       key: 'createdCallback',

       /**
        * @event changestate
        * @description
        *   [en]Fired when the state is changed. The state can be either "initial", "preaction" or "action".[/en]
        *   [ja]コンポーネントの状態が変わった場合に発火します。状態は、"initial", "preaction", "action"のいずれかです。[/ja]
        * @param {Object} event
        *   [en]Event object.[/en]
        *   [ja]イベントオブジェクト。[/ja]
        * @param {Object} event.pullHook
        *   [en]Component object.[/en]
        *   [ja]コンポーネントのオブジェクト。[/ja]
        * @param {String} event.state
        *   [en]Current state.[/en]
        *   [ja]現在の状態名を参照できます。[/ja]
        */

       /**
        * @attribute disabled
        * @description
        *   [en]If this attribute is set the "pull-to-refresh" functionality is disabled.[/en]
        *   [ja]この属性がある時、disabled状態になりアクションが実行されなくなります[/ja]
        */

       /**
        * @attribute height
        * @type {String}
        * @description
        *   [en]Specify the height of the component. When pulled down further than this value it will switch to the "preaction" state. The default value is "64px".[/en]
        *   [ja]コンポーネントの高さを指定します。この高さ以上にpull downすると"preaction"状態に移行します。デフォルトの値は"64px"です。[/ja]
        */

       /**
        * @attribute threshold-height
        * @type {String}
        * @description
        *   [en]Specify the threshold height. The component automatically switches to the "action" state when pulled further than this value. The default value is "96px". A negative value or a value less than the height will disable this property.[/en]
        *   [ja]閾値となる高さを指定します。この値で指定した高さよりもpull downすると、このコンポーネントは自動的に"action"状態に移行します。[/ja]
        */

       /**
        * @attribute fixed-content
        * @description
        *   [en]If this attribute is set the content of the page will not move when pulling.[/en]
        *   [ja]この属性がある時、プルフックが引き出されている時にもコンテンツは動きません。[/ja]
        */

       value: function createdCallback() {
         if (!this.hasAttribute('_compiled')) {
           this._scrollElement = this._createScrollElement();
           this.setAttribute('_compiled', '');
         } else {
           this._scrollElement = this.parentElement;
         }

         this._pageElement = this._scrollElement.parentElement;

         if (!this._pageElement.classList.contains('page__content') && !this._pageElement.classList.contains('ons-scroller__content')) {
           throw new Error('<ons-pull-hook> must be a direct descendant of an <ons-page> or an <ons-scroller> element.');
         }

         this._boundOnDrag = this._onDrag.bind(this);
         this._boundOnDragStart = this._onDragStart.bind(this);
         this._boundOnDragEnd = this._onDragEnd.bind(this);
         this._boundOnScroll = this._onScroll.bind(this);

         this._currentTranslation = 0;

         this._setState(STATE_INITIAL, true);
         this._setStyle();
       }
     }, {
       key: '_createScrollElement',
       value: function _createScrollElement() {
         var scrollElement = util.createElement('<div class="scroll"><div>');

         var pageElement = this.parentElement;

         scrollElement.appendChild(this);
         while (pageElement.firstChild) {
           scrollElement.appendChild(pageElement.firstChild);
         }
         pageElement.appendChild(scrollElement);

         return scrollElement;
       }
     }, {
       key: '_setStyle',
       value: function _setStyle() {
         var height = this.getHeight();

         this.style.top = '-' + height + 'px';
         this.style.height = height + 'px';
         this.style.lineHeight = height + 'px';
       }
     }, {
       key: '_onScroll',
       value: function _onScroll(event) {
         var element = this._pageElement;

         if (element.scrollTop < 0) {
           element.scrollTop = 0;
         }
       }
     }, {
       key: '_generateTranslationTransform',
       value: function _generateTranslationTransform(scroll) {
         return 'translate3d(0px, ' + scroll + 'px, 0px)';
       }
     }, {
       key: '_onDrag',
       value: function _onDrag(event) {
         var _this2 = this;

         if (this.isDisabled()) {
           return;
         }

         // Ignore when dragging left and right.
         if (event.gesture.direction === 'left' || event.gesture.direction === 'right') {
           return;
         }

         // Hack to make it work on Android 4.4 WebView. Scrolls manually near the top of the page so
         // there will be no inertial scroll when scrolling down. Allowing default scrolling will
         // kill all 'touchmove' events.
         var element = this._pageElement;
         element.scrollTop = this._startScroll - event.gesture.deltaY;
         if (element.scrollTop < window.innerHeight && event.gesture.direction !== 'up') {
           event.gesture.preventDefault();
         }

         if (this._currentTranslation === 0 && this._getCurrentScroll() === 0) {
           this._transitionDragLength = event.gesture.deltaY;

           var direction = event.gesture.interimDirection;
           if (direction === 'down') {
             this._transitionDragLength -= 1;
           } else {
             this._transitionDragLength += 1;
           }
         }

         var scroll = Math.max(event.gesture.deltaY - this._startScroll, 0);

         if (this._thresholdHeightEnabled() && scroll >= this.getThresholdHeight()) {
           event.gesture.stopDetect();

           setImmediate(function () {
             _this2._setState(STATE_ACTION);
             _this2._translateTo(_this2.getHeight(), { animate: true });

             _this2._waitForAction(_this2._onDone.bind(_this2));
           });
         } else if (scroll >= this.getHeight()) {
           this._setState(STATE_PREACTION);
         } else {
           this._setState(STATE_INITIAL);
         }

         event.stopPropagation();
         this._translateTo(scroll);
       }
     }, {
       key: '_onDragStart',
       value: function _onDragStart(event) {
         if (this.isDisabled()) {
           return;
         }

         this._startScroll = this._getCurrentScroll();
       }
     }, {
       key: '_onDragEnd',
       value: function _onDragEnd(event) {
         if (this.isDisabled()) {
           return;
         }

         if (this._currentTranslation > 0) {
           var scroll = this._currentTranslation;

           if (scroll > this.getHeight()) {
             this._setState(STATE_ACTION);

             this._translateTo(this.getHeight(), { animate: true });

             this._waitForAction(this._onDone.bind(this));
           } else {
             this._translateTo(0, { animate: true });
           }
         }
       }

       /**
        * @param {Function} callback
        */

     }, {
       key: 'setActionCallback',
       value: function setActionCallback(callback) {
         this._callback = callback;
       }
     }, {
       key: '_waitForAction',
       value: function _waitForAction(done) {
         if (this._callback instanceof Function) {
           this._callback.call(null, done);
         } else {
           done();
         }
       }
     }, {
       key: '_onDone',
       value: function _onDone(done) {
         // Check if the pull hook still exists.
         this._translateTo(0, { animate: true });
         this._setState(STATE_INITIAL);
       }

       /**
        * @method getHeight
        * @signature getHeight()
        * @return {Number}
        * @description
        *   [en]Returns the height of the pull hook in pixels.[/en]
        *   [ja]プルフックの高さをピクセル数で返します。[/ja]
        */

     }, {
       key: 'getHeight',
       value: function getHeight() {
         return parseInt(this.getAttribute('height') || '64', 10);
       }

       /**
        * @method setHeight
        * @signature setHeight(height)
        * @param {Number} height
        *   [en]Desired height.[/en]
        *   [ja]要素の高さを指定します。[/ja]
        * @description
        *   [en]Specify the height.[/en]
        *   [ja]高さを指定できます。[/ja]
        */

     }, {
       key: 'setHeight',
       value: function setHeight(height) {
         this.setAttribute('height', height + 'px');

         this._setStyle();
       }

       /**
        * @method setThresholdHeight
        * @signature setThresholdHeight(thresholdHeight)
        * @param {Number} thresholdHeight
        *   [en]Desired threshold height.[/en]
        *   [ja]プルフックのアクションを起こす閾値となる高さを指定します。[/ja]
        * @description
        *   [en]Specify the threshold height.[/en]
        *   [ja]閾値となる高さを指定できます。[/ja]
        */

     }, {
       key: 'setThresholdHeight',
       value: function setThresholdHeight(thresholdHeight) {
         this.setAttribute('threshold-height', thresholdHeight + 'px');
       }

       /**
        * @method getThresholdHeight
        * @signature getThresholdHeight()
        * @description
        *   [en]Returns the height of the threshold in pixels.[/en]
        *   [ja]閾値、となる高さをピクセル数で返します。[/ja]
        * @return {Number}
        */

     }, {
       key: 'getThresholdHeight',
       value: function getThresholdHeight() {
         return parseInt(this.getAttribute('threshold-height') || '96', 10);
       }
     }, {
       key: '_thresholdHeightEnabled',
       value: function _thresholdHeightEnabled() {
         var th = this.getThresholdHeight();
         return th > 0 && th >= this.getHeight();
       }
     }, {
       key: '_setState',
       value: function _setState(state, noEvent) {
         var lastState = this._getState();

         this.setAttribute('state', state);

         if (!noEvent && lastState !== this._getState()) {
           util.triggerElementEvent(this, 'changestate', {
             pullHook: this,
             state: state,
             lastState: lastState
           });
         }
       }
     }, {
       key: '_getState',
       value: function _getState() {
         return this.getAttribute('state');
       }

       /**
        * @method getCurrentState
        * @signature getCurrentState()
        * @return {String}
        * @description
        *   [en]Returns the current state of the element.[/en]
        *   [ja]要素の現在の状態を返します。[/ja]
        */

     }, {
       key: 'getCurrentState',
       value: function getCurrentState() {
         return this._getState();
       }
     }, {
       key: '_getCurrentScroll',
       value: function _getCurrentScroll() {
         return this._pageElement.scrollTop;
       }

       /**
        * @method getPullDistance
        * @signature getPullDistance()
        * @return {Number}
        * @description
        *   [en]Returns the current number of pixels the pull hook has moved.[/en]
        *   [ja]現在のプルフックが引き出された距離をピクセル数で返します。[/ja]
        */

     }, {
       key: 'getPullDistance',
       value: function getPullDistance() {
         return this._currentTranslation;
       }

       /**
        * @method isDisabled
        * @signature isDisabled()
        * @return {Boolean}
        *   [en]true if the pull hook is disabled.[/en]
        *   [ja]プルフックがdisabled状態の場合、trueを返します。[/ja]
        * @description
        *   [en]Returns whether the component is disabled or enabled.[/en]
        *   [ja]disabled状態になっているかを得ることが出来ます。[/ja]
        */

     }, {
       key: 'isDisabled',
       value: function isDisabled() {
         return this.hasAttribute('disabled');
       }
     }, {
       key: '_isContentFixed',
       value: function _isContentFixed() {
         return this.hasAttribute('fixed-content');
       }

       /**
        * @method setDisabled
        * @signature setDisabled(disabled)
        * @param {Boolean} disabled
        *   [en]If true the pull hook will be disabled.[/en]
        *   [ja]trueを指定すると、プルフックがdisabled状態になります。[/ja]
        * @description
        *   [en]Disable or enable the component.[/en]
        *   [ja]disabled状態にするかどうかを設定できます。[/ja]
        */

     }, {
       key: 'setDisabled',
       value: function setDisabled(disabled) {
         if (disabled) {
           this.setAttribute('disabled', '');
         } else {
           this.removeAttribute('disabled');
         }
       }
     }, {
       key: '_getScrollableElement',
       value: function _getScrollableElement() {
         if (this._isContentFixed()) {
           return this;
         } else {
           return this._scrollElement;
         }
       }

       /**
        * @param {Number} scroll
        * @param {Object} options
        * @param {Function} [options.callback]
        */

     }, {
       key: '_translateTo',
       value: function _translateTo(scroll) {
         var _this3 = this;

         var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

         if (this._currentTranslation == 0 && scroll == 0) {
           return;
         }

         var done = function done() {
           if (scroll === 0) {
             _this3._getScrollableElement().removeAttribute('style');
           }

           if (options.callback) {
             options.callback();
           }
         };

         this._currentTranslation = scroll;

         if (options.animate) {
           animit(this._getScrollableElement()).queue({
             transform: this._generateTranslationTransform(scroll)
           }, {
             duration: 0.3,
             timing: 'cubic-bezier(.1, .7, .1, 1)'
           }).play(done);
         } else {
           animit(this._getScrollableElement()).queue({
             transform: this._generateTranslationTransform(scroll)
           }).play(done);
         }
       }
     }, {
       key: '_getMinimumScroll',
       value: function _getMinimumScroll() {
         var scrollHeight = this._scrollElement.getBoundingClientRect().height;
         var pageHeight = this._pageElement.getBoundingClientRect().height;

         return scrollHeight > pageHeight ? -(scrollHeight - pageHeight) : 0;
       }
     }, {
       key: '_createEventListeners',
       value: function _createEventListeners() {
         this._gestureDetector = new GestureDetector(this._pageElement, {
           dragMinDistance: 1,
           dragDistanceCorrection: false
         });

         // Bind listeners
         this._gestureDetector.on('drag', this._boundOnDrag);
         this._gestureDetector.on('dragstart', this._boundOnDragStart);
         this._gestureDetector.on('dragend', this._boundOnDragEnd);

         this._scrollElement.parentElement.addEventListener('scroll', this._boundOnScroll, false);
       }
     }, {
       key: '_destroyEventListeners',
       value: function _destroyEventListeners() {
         this._gestureDetector.off('drag', this._boundOnDrag);
         this._gestureDetector.off('dragstart', this._boundOnDragStart);
         this._gestureDetector.off('dragend', this._boundOnDragEnd);

         this._gestureDetector.dispose();
         this._gestureDetector = null;

         this._scrollElement.parentElement.removeEventListener('scroll', this._boundOnScroll, false);
       }
     }, {
       key: 'attachedCallback',
       value: function attachedCallback() {
         this._createEventListeners();
       }
     }, {
       key: 'detachedCallback',
       value: function detachedCallback() {
         this._destroyEventListeners();
       }
     }, {
       key: 'attributeChangedCallback',
       value: function attributeChangedCallback(name, last, current) {}
     }]);
     return PullHookElement;
   })(BaseElement);

   window.OnsPullHookElement = document.registerElement('ons-pull-hook', {
     prototype: PullHookElement.prototype
   });

   window.OnsPullHookElement.STATE_ACTION = STATE_ACTION;
   window.OnsPullHookElement.STATE_INITIAL = STATE_INITIAL;
   window.OnsPullHookElement.STATE_PREACTION = STATE_PREACTION;

   /*
   Copyright 2013-2016 ASIAL CORPORATION

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.

   */

   /**
    * @class AnimatorCSS - implementation of Animator class using css transitions
    */

   var AnimatorCSS = (function () {
     babelHelpers.createClass(AnimatorCSS, [{
       key: 'animate',

       /**
        * @method animate
        * @desc main animation function
        * @param {Element} element
        * @param {Object} finalCSS
        * @param {number} [duration=200] - duration in milliseconds
        * @return {Object} result
        * @return {Function} result.then(callback) - sets a callback to be executed after the animation has stopped
        * @return {Function} result.stop(options) - stops the animation; if options.stopNext is true then it doesn't call the callback
        * @return {Function} result.finish(ms) - finishes the animation in the specified time in milliseconds
        * @return {Function} result.speed(ms) - sets the animation speed so that it finishes as if the original duration was the one specified here
        * @example
        * ````
        *  var result = animator.animate(el, {opacity: 0.5}, 1000);
        *
        *  el.addEventListener('click', function(e){
        *    result.speed(200).then(function(){
        *      console.log('done');
        *    });
        *  }, 300);
        * ````
        */
       value: function animate(el, final) {
         var duration = arguments.length <= 2 || arguments[2] === undefined ? 200 : arguments[2];

         var start = new Date().getTime(),
             initial = {},
             stopped = false,
             next = false,
             timeout = false,
             properties = Object.keys(final);

         var updateStyles = function updateStyles() {
           var s = window.getComputedStyle(el);
           properties.forEach(s.getPropertyValue.bind(s));
           s = el.offsetHeight;
         };

         var result = {
           stop: function stop() {
             var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

             timeout && clearTimeout(timeout);
             var k = Math.min(1, (new Date().getTime() - start) / duration);
             properties.forEach(function (i) {
               el.style[i] = (1 - k) * initial[i] + k * final[i] + (i == 'opacity' ? '' : 'px');
             });
             el.style.transitionDuration = '0s';

             if (options.stopNext) {
               next = false;
             } else if (!stopped) {
               stopped = true;
               next && next();
             }
             return result;
           },
           then: function then(cb) {
             next = cb;
             if (stopped) {
               next && next();
             }
             return result;
           },
           speed: function speed(newDuration) {
             if (ons._config.animationsDisabled) {
               newDuration = 0;
             }
             if (!stopped) {
               (function () {
                 timeout && clearTimeout(timeout);

                 var passed = new Date().getTime() - start;
                 var k = passed / duration;
                 var remaining = newDuration * (1 - k);

                 properties.forEach(function (i) {
                   el.style[i] = (1 - k) * initial[i] + k * final[i] + (i == 'opacity' ? '' : 'px');
                 });

                 updateStyles();

                 start = el.speedUpTime;
                 duration = remaining;

                 el.style.transitionDuration = duration / 1000 + 's';

                 properties.forEach(function (i) {
                   el.style[i] = final[i] + (i == 'opacity' ? '' : 'px');
                 });

                 timeout = setTimeout(result.stop, remaining);
               })();
             }
             return result;
           },
           finish: function finish() {
             var milliseconds = arguments.length <= 0 || arguments[0] === undefined ? 50 : arguments[0];

             var k = (new Date().getTime() - start) / duration;

             result.speed(milliseconds / (1 - k));
             return result;
           }
         };

         if (el.hasAttribute('disabled') || stopped || ons._config.animationsDisabled) {
           return result;
         }

         var style = window.getComputedStyle(el);
         properties.forEach(function (e) {
           var v = parseFloat(style.getPropertyValue(e));
           initial[e] = isNaN(v) ? 0 : v;
         });

         if (!stopped) {
           el.style.transitionProperty = properties.join(',');
           el.style.transitionDuration = duration / 1000 + 's';

           properties.forEach(function (e) {
             el.style[e] = final[e] + (e == 'opacity' ? '' : 'px');
           });
         }

         timeout = setTimeout(result.stop, duration);
         this._onStopAnimations(el, result.stop);

         return result;
       }
     }]);

     function AnimatorCSS() {
       babelHelpers.classCallCheck(this, AnimatorCSS);

       this._queue = [];
       this._index = 0;
     }

     babelHelpers.createClass(AnimatorCSS, [{
       key: '_onStopAnimations',
       value: function _onStopAnimations(el, listener) {
         var queue = this._queue;
         var i = this._index++;
         queue[el] = queue[el] || [];
         queue[el][i] = function (options) {
           delete queue[el][i];
           if (queue[el] && queue[el].length == 0) {
             delete queue[el];
           }
           return listener(options);
         };
       }

       /**
       * @method stopAnimations
       * @desc stops active animations on a specified element
       * @param {Element|Array} element - element or array of elements
       * @param {Object} [options={}]
       * @param {Boolean} [options.stopNext] - the callbacks after the animations won't be called if this option is true
       */

     }, {
       key: 'stopAnimations',
       value: function stopAnimations(el) {
         var _this = this;

         var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

         if (Array.isArray(el)) {
           return el.forEach(function (el) {
             _this.stopAnimations(el, options);
           });
         }

         (this._queue[el] || []).forEach(function (e) {
           e(options || {});
         });
       }

       /**
       * @method stopAll
       * @desc stops all active animations
       * @param {Object} [options={}]
       * @param {Boolean} [options.stopNext] - the callbacks after the animations won't be called if this option is true
       */

     }, {
       key: 'stopAll',
       value: function stopAll() {
         var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

         this.stopAnimations(Object.keys(this._queue), options);
       }

       /**
       * @method fade
       * @desc fades the element (short version for animate(el, {opacity: 0}))
       * @param {Element} element
       * @param {number} [duration=200]
       */

     }, {
       key: 'fade',
       value: function fade(el) {
         var duration = arguments.length <= 1 || arguments[1] === undefined ? 200 : arguments[1];

         return this.animate(el, { opacity: 0 }, duration);
       }
     }]);
     return AnimatorCSS;
   })();

   /**
    * @element ons-ripple
    * @category form
    * @description
    *   [en]Adds a Material Design "ripple" effect to an element.[/en]
    *   [ja]マテリアルデザインのリップル効果をDOM要素に追加します。[/ja]
    * @codepen wKQWdZ
    * @example
    * <ons-list>
    *   <ons-list-item>
    *    <ons-ripple color="rgba(0, 0, 0, 0.3)"></ons-ripple>
    *    Click me!
    *   </ons-list-item>
    * </ons-list>
    */

   var RippleElement = (function (_BaseElement) {
     babelHelpers.inherits(RippleElement, _BaseElement);

     function RippleElement() {
       babelHelpers.classCallCheck(this, RippleElement);
       return babelHelpers.possibleConstructorReturn(this, Object.getPrototypeOf(RippleElement).apply(this, arguments));
     }

     babelHelpers.createClass(RippleElement, [{
       key: 'createdCallback',

       /**
        * @attribute color
        * @type {String}
        * @description
        *   [en]Color of the ripple effect.[/en]
        *   [ja]リップルエフェクトの色を指定します。[/ja]
        */

       /**
        * @attribute color
        * @type {String}
        * @description
        *   [en]Color of the ripple effect.[/en]
        *   [ja]リップルエフェクトの色を指定します。[/ja]
        */

       /**
        * @attribute background
        * @description
        *   [en]Color of the background.[/en]
        *   [ja]背景の色を設定します。[/ja]
        */

       /**
        * @attribute disabled
        * @description
        *   [en]If this attribute is set, the ripple effect will be disabled.[/en]
        *   [ja]この属性が設定された場合、リップルエフェクトは無効になります。[/ja]
        */

       value: function createdCallback() {
         var _this2 = this;

         this.classList.add('ripple');
         if (!this.hasAttribute('_compiled')) {
           this._compile();
         } else {
           this._background = this.getElementsByClassName('ripple__background')[0];
           this._wave = this.getElementsByClassName('ripple__wave')[0];
         }

         this._animator = new AnimatorCSS();

         ['color', 'center', 'start-radius', 'background'].forEach(function (e) {
           _this2.attributeChangedCallback(e, null, _this2.getAttribute(e));
         });
       }
     }, {
       key: '_compile',
       value: function _compile() {
         var _this3 = this;

         ['_wave', '_background'].forEach(function (e) {
           _this3[e] = document.createElement('div');
           _this3[e].classList.add('ripple_' + e);
           _this3.appendChild(_this3[e]);
         });
         this.setAttribute('_compiled', '');
       }
     }, {
       key: '_calculateCoords',
       value: function _calculateCoords(e) {
         var x, y, h, w, r;
         var b = this.getBoundingClientRect();
         if (this._center) {
           x = b.width / 2;
           y = b.height / 2;
           r = Math.sqrt(x * x + y * y);
         } else {
           x = (e.clientX || e.changedTouches[0].clientX) - b.left;
           y = (e.clientY || e.changedTouches[0].clientY) - b.top;
           h = Math.max(y, b.height - y);
           w = Math.max(x, b.width - x);
           r = Math.sqrt(h * h + w * w);
         }
         return { x: x, y: y, r: r };
       }
     }, {
       key: '_rippleAnimation',
       value: function _rippleAnimation(e) {
         var duration = arguments.length <= 1 || arguments[1] === undefined ? 300 : arguments[1];
         var _animator = this._animator;
         var _wave = this._wave;
         var _background = this._background;

         var _minR = this._minR;

         var _calculateCoords2 = this._calculateCoords(e);

         var x = _calculateCoords2.x;
         var y = _calculateCoords2.y;
         var r = _calculateCoords2.r;

         _animator.stopAll({ stopNext: 1 });
         _animator.animate(_background, { opacity: 1 }, duration);

         util.extend(_wave.style, {
           opacity: 1,
           top: y - _minR + 'px',
           left: x - _minR + 'px',
           width: 2 * _minR + 'px',
           height: 2 * _minR + 'px'
         });

         return _animator.animate(_wave, {
           top: y - r,
           left: x - r,
           height: 2 * r,
           width: 2 * r
         }, duration);
       }
     }, {
       key: '_updateParent',
       value: function _updateParent() {
         if (!this._parentUpdated && this.parentNode) {
           var computedStyle = window.getComputedStyle(this.parentNode);
           if (computedStyle.getPropertyValue('position') === 'static') {
             this.parentNode.style.position = 'relative';
           }
           this._parentUpdated = true;
         }
       }
     }, {
       key: '_onTap',
       value: function _onTap(e) {
         var _this4 = this;

         if (!this.isDisabled()) {
           this._updateParent();
           this._rippleAnimation(e.gesture.srcEvent).then(function () {
             _this4._animator.fade(_this4._wave);
             _this4._animator.fade(_this4._background);
           });
         }
       }
     }, {
       key: '_onHold',
       value: function _onHold(e) {
         if (!this.isDisabled()) {
           this._updateParent();
           this._holding = this._rippleAnimation(e.gesture.srcEvent, 2000);
           document.addEventListener('release', this._boundOnRelease);
         }
       }
     }, {
       key: '_onRelease',
       value: function _onRelease(e) {
         var _this5 = this;

         if (this._holding) {
           this._holding.speed(300).then(function () {
             _this5._animator.stopAll({ stopNext: true });
             _this5._animator.fade(_this5._wave);
             _this5._animator.fade(_this5._background);
           });

           this._holding = false;
         }

         document.removeEventListener('release', this._boundOnRelease);
       }
     }, {
       key: '_onDragStart',
       value: function _onDragStart(e) {
         if (this._holding) {
           return this._onRelease(e);
         }
         if (['left', 'right'].indexOf(e.gesture.direction) != -1) {
           this._onTap(e);
         }
       }
     }, {
       key: 'attachedCallback',
       value: function attachedCallback() {
         this._boundOnTap = this._onTap.bind(this);
         this._boundOnHold = this._onHold.bind(this);
         this._boundOnDragStart = this._onDragStart.bind(this);
         this._boundOnRelease = this._onRelease.bind(this);

         if (ons._config.animationsDisabled) {
           this.setDisabled(true);
         } else {
           this.parentNode.addEventListener('tap', this._boundOnTap);
           this.parentNode.addEventListener('hold', this._boundOnHold);
           this.parentNode.addEventListener('dragstart', this._boundOnDragStart);
         }
       }
     }, {
       key: 'detachedCallback',
       value: function detachedCallback() {
         this.parentNode.removeEventListener('tap', this._boundOnTap);
         this.parentNode.removeEventListener('hold', this._boundOnHold);
         this.parentNode.removeEventListener('dragstart', this._boundOnDragStart);
       }
     }, {
       key: 'attributeChangedCallback',
       value: function attributeChangedCallback(name, last, current) {
         if (name === 'start-radius') {
           this._minR = Math.max(0, parseFloat(current) || 0);
         }
         if (name === 'color' && current) {
           this._wave.style.background = current;
           if (!this.hasAttribute('background')) {
             this._background.style.background = current;
           }
         }
         if (name === 'background' && (current || last)) {
           if (current === 'none') {
             this._background.setAttribute('disabled', 'disabled');
             this._background.style.background = 'transparent';
           } else {
             if (this._background.hasAttribute('disabled')) {
               this._background.removeAttribute('disabled');
             }
             this._background.style.background = current;
           }
         }
         if (name === 'center') {
           this._center = current != null && current != 'false';
         }
       }

       /**
       * Disable or enable ripple-effect.
       *
       * @param {Boolean}
       */

     }, {
       key: 'setDisabled',
       value: function setDisabled(disabled) {
         if (typeof disabled !== 'boolean') {
           throw new Error('Argument must be a boolean.');
         }
         if (disabled) {
           this.setAttribute('disabled', '');
         } else {
           this.removeAttribute('disabled');
         }
       }

       /**
        * True if ripple-effect is disabled.
        *
        * @return {Boolean}
        */

     }, {
       key: 'isDisabled',
       value: function isDisabled() {
         return this.hasAttribute('disabled'); // || this.parentNode.hasAttribute('disabled');
       }
     }]);
     return RippleElement;
   })(BaseElement);

   window.OnsRippleElement = document.registerElement('ons-ripple', {
     prototype: RippleElement.prototype
   });

   /*
   Copyright 2013-2015 ASIAL CORPORATION

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.

   */

   /**
    * @element ons-row
    * @category grid
    * @description
    *   [en]Represents a row in the grid system. Use with ons-col to layout components.[/en]
    *   [ja]グリッドシステムにて行を定義します。ons-colとともに使用し、コンポーネントの配置に使用します。[/ja]
    * @codepen GgujC {wide}
    * @guide Layouting
    *   [en]Layouting guide[/en]
    *   [ja]レイアウト調整[/ja]
    * @seealso ons-col
    *   [en]ons-col component[/en]
    *   [ja]ons-colコンポーネント[/ja]
    * @note
    *   [en]For Android 4.3 and earlier, and iOS6 and earlier, when using mixed alignment with ons-row and ons-col, they may not be displayed correctly. You can use only one vertical-align.[/en]
    *   [ja]Android 4.3以前、もしくはiOS 6以前のOSの場合、ons-rowとons-colを組み合わせてそれぞれのons-col要素のvertical-align属性の値に別々の値を指定すると、描画が崩れる場合があります。vertical-align属性の値には一つの値だけを指定できます。[/ja]
    * @example
    * <ons-row>
    *   <ons-col width="50px"><ons-icon icon="fa-twitter"></ons-icon></ons-col>
    *   <ons-col>Text</ons-col>
    * </ons-row>
    */

   /**
    * @attribute vertical-align
    * @type {String}
    * @description
    *   [en]Short hand attribute for aligning vertically. Valid values are top, bottom, and center.[/en]
    *   [ja]縦に整列するために指定します。top、bottom、centerのいずれかを指定できます。[/ja]
    */
   window.OnsRowElement = window.OnsRowElement ? window.OnsRowElement : document.registerElement('ons-row');

   /*
   Copyright 2013-2015 ASIAL CORPORATION

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.

   */

   /**
    * @element ons-scroller
    * @category page
    * @description
    *   [en]Makes the content inside this tag scrollable.[/en]
    *   [ja]要素内をスクロール可能にします。[/ja]
    * @example
    * <ons-scroller style="height: 200px; width: 100%">
    *   ...
    * </ons-scroller>
    */
   window.OnsScrollerElement = window.OnsScrollerElement ? window.OnsScrollerElement : document.registerElement('ons-scroller');

   // TODO: Add codepen example.

   /**
    * @element ons-ripple
    * @category control
    * @description
    *   [en]Adds scrollbar to the parent element. NOTE: the parent should have a fixed size.[/en]
    *   [ja][/ja]
    * @example
    * <div>
    *   Lorem ipsum dolor sit amet...
    *   <ons-scrollbar draggable></ons-scrollbar>
    * </div>
    *
    * <div>
    *   Lorem ipsum dolor sit amet...
    *   <ons-scrollbar autohide></ons-scrollbar>
    * </div>
    */

   var ScrollbarElement = (function (_BaseElement) {
     babelHelpers.inherits(ScrollbarElement, _BaseElement);

     function ScrollbarElement() {
       babelHelpers.classCallCheck(this, ScrollbarElement);
       return babelHelpers.possibleConstructorReturn(this, Object.getPrototypeOf(ScrollbarElement).apply(this, arguments));
     }

     babelHelpers.createClass(ScrollbarElement, [{
       key: 'createdCallback',

       /**
        * @attribute height
        * @type {Number}
        * @description
        *   [en]If set then the height of the scrollbar will be fixed to this value. Otherwise it will be a dynamic value based on the visible proportion of the content. The value can only be in px and is ignored if it's zero.[/en]
        *   [ja][/ja]
        */

       /**
        * @attribute draggable
        * @description
        *   [en]If this attribute is set then the scrollbar will be draggable.[/en]
        *   [ja][/ja]
        */

       /**
        * @attribute autohide
        * @type {String}
        * @description
        *   [en]If this attribute is set then the scrollbar will disappear shortly after scrolling.[/en]
        *   [ja][/ja]
        */

       /**
        * @attribute autohide-delay
        * @type {Number}
        * @description
        *   [en]Delay (in ms) after which the scrollbar will disappear if autohide is set.[/en]
        *   [ja][/ja]
        */

       /**
        * @attribute hidden
        * @type {String}
        * @description
        *   [en]If this attribute is set then the scrollbar will be hidden with `display: none`.[/en]
        *   [ja][/ja]
        */

       /**
        * @attribute update-on-scroll
        * @description
        *   [en]If this attribute is set then the scrollbar will update it's size and container on every scroll event. Useful if the size of the content changes frequently. Otherwise `updateScrollbar` method should be called manually when the content size changes. [/en]
        *   [ja][/ja]
        */

       value: function createdCallback() {
         var _this2 = this;

         if (!this.hasAttribute('_compiled')) {
           this._compile();
         } else {
           this._scroll = this.getElementsByClassName('scrollbar')[0];
         }
         this._timeout = false;
         this._limitReached = 0;
         this.onInfiniteScrollLimit = 0.75;

         this._boundOnDragStart = this._onDragStart.bind(this);
         this._boundOnScroll = this._onScroll.bind(this);
         this._boundOnResize = this._onResize.bind(this);

         ['height', 'draggable', 'autohide', 'autohide-delay', 'hidden', 'update-on-scroll'].forEach(function (e) {
           _this2.attributeChangedCallback(e, null, _this2.getAttribute(e));
         });
       }
     }, {
       key: '_compile',
       value: function _compile() {
         this.classList.add('scrollbar-container');
         this._scroll = util.createElement('<div class="scrollbar"><div class="scrollbar-touch"></div></div>');
         this.appendChild(this._scroll);
         this.setAttribute('_compiled', '');
       }
     }, {
       key: '_attach',
       value: function _attach() {
         var _this3 = this;

         var styles = window.getComputedStyle(this.parentNode);
         if (styles.getPropertyValue('position') === 'static') {
           this.parentNode.style.position = 'relative';
         }

         this._content = util.createElement('<div class="scrollbar-content"></div>');
         Array.prototype.slice.call(this.parentNode.childNodes).forEach(function (e) {
           if (e != _this3) {
             _this3._content.appendChild(e);
           }
         });
         this.parentNode.insertBefore(this._content, this);
         this.setAttribute('_attached', '');
       }
     }, {
       key: '_onScroll',
       value: function _onScroll(e) {
         var _this4 = this;

         if (this._updateOnScroll) {
           this.updateScrollbar();
         } else {
           this._updateScrollbarLocation();
         }

         if (this._autohide) {
           this._updateAutohide();
         }
         if (!this._limitReached && this._overLimit()) {
           this._limitReached = 1;
           this.onInfiniteScroll && this.onInfiniteScroll(function () {
             _this4.updateScrollbar();
             _this4._limitReached = 0;
           });
         }
       }
     }, {
       key: '_onResize',
       value: function _onResize(e) {
         this.updateScrollbar();
       }
     }, {
       key: '_updateAutohide',
       value: function _updateAutohide() {
         var _this5 = this;

         if (!this._scrolling) {
           this._scrolling = true;
           this.classList.add('scrollbar-autohide-visible');
         }
         clearTimeout(this._timeout);
         this._timeout = setTimeout(function () {
           _this5._scrolling = false;
           _this5.classList.remove('scrollbar-autohide-visible');
         }, this._autohideDelay);
       }
     }, {
       key: '_overLimit',
       value: function _overLimit(e) {
         var c = this._content;
         return (c.scrollTop + c.clientHeight) / c.scrollHeight >= this.onInfiniteScrollLimit;
       }

       /**
        * @method updateScrollbar
        * @signature updateScrollbar()
        * @description
        *   [en]Updates teh scrollbar size and location. Should be called if the size of the content changes. Automatically called when onInfiniteScroll handler is finished.[/en]
        *   [ja][/ja]
        */

     }, {
       key: 'updateScrollbar',
       value: function updateScrollbar() {
         var content = this._content;
         var scroll = this._scroll;
         var container = this;

         if (!this._hidden) {
           scroll.style.display = content.clientHeight >= content.scrollHeight ? 'none' : 'block';
           scroll.style.height = Math.round(this._height || container.clientHeight * content.clientHeight / content.scrollHeight) + 'px';
           this._contentMax = content.scrollHeight - content.clientHeight;
           this._scrollMax = container.clientHeight - scroll.clientHeight;
           this._updateScrollbarLocation();
         }
       }
     }, {
       key: '_updateScrollbarLocation',
       value: function _updateScrollbarLocation() {
         this._scroll.style.top = Math.round(this._scrollMax * this._content.scrollTop / this._contentMax) + 'px';
       }
     }, {
       key: '_onDragStart',
       value: function _onDragStart(e) {
         var _this6 = this;

         var startY = this._scroll.offsetTop;
         var onMove = function onMove(e) {
           _this6.classList.add('scrollbar-dragging');
           var progress = Math.min(1, Math.max(0, (startY + e.gesture.deltaY) / _this6._scrollMax));
           _this6._content.scrollTop = _this6._contentMax * progress;
         };
         document.addEventListener('drag', onMove);
         document.addEventListener('release', function () {
           _this6.classList.remove('scrollbar-dragging');
           document.removeEventListener('drag', onMove);
         });
       }
     }, {
       key: '_onTouchStart',
       value: function _onTouchStart(e) {
         e.preventDefault();
       }
     }, {
       key: 'attachedCallback',
       value: function attachedCallback() {
         if (!this.hasAttribute('_attached')) {
           this._attach();
         } else {
           this._content = this.parentNode.getElementsByClassName('scrollbar-content')[0];
         }

         this._content.addEventListener('scroll', this._boundOnScroll);
         window.addEventListener('resize', this._boundOnResize);
         this.updateScrollbar();

         if (this._draggable) {
           this._scroll.addEventListener('dragstart', this._boundOnDragStart);
           this._scroll.addEventListener('touchstart', this._onTouchStart);
         }
       }
     }, {
       key: 'detachedCallback',
       value: function detachedCallback() {
         this._content.removeEventListener('scroll', this._boundOnScroll);
         this._scroll.removeEventListener('dragstart', this._boundOnDragStart);
         this._scroll.removeEventListener('touchstart', this._onTouchStart);
         this._timeout && clearTimeout(this._timeout);
         window.removeEventListener('resize', this._boundOnResize);
       }
     }, {
       key: 'attributeChangedCallback',
       value: function attributeChangedCallback(name, last, current) {
         if (name === 'update-on-scroll') {
           this._updateOnScroll = current !== null;
         }
         if (name === 'autohide-delay') {
           this._autohideDelay = parseInt(current) || 500;
         }
         if (name === 'height') {
           this._height = parseInt(current) || 0;
         }
         if (['draggable', 'autohide', 'hidden'].indexOf(name) !== -1) {
           this['_' + name] = current !== null;
         }
         this._content && this.updateScrollbar();
       }
     }]);
     return ScrollbarElement;
   })(BaseElement);

   window.OnsScrollbarElement = document.registerElement('ons-scrollbar', {
     prototype: ScrollbarElement.prototype
   });

   var scheme$13 = {
     '': 'speed-dial__item--*'
   };

   /**
    * @element ons-speed-dial-item
    * @category speeddial
    * @description
    *   [en]This component displays the child elements of the Material Design Speed dial component.[/en]
    *   [ja]Material DesignのSpeed dialの子要素を表現する要素です。[/ja]
    * @codepen dYQYLg
    * @seealso ons-speed-dial
    *   [en]ons-speed-dial component[/en]
    *   [ja]ons-speed-dialコンポーネント[/ja]
    * @example
    * <ons-speed-dial position="left bottom">
    *   <ons-icon
    *     icon="fa-twitter"
    *     size="26px"
    *     fixed-width="false"
    *     style="vertical-align:middle;">
    *   </ons-icon>
    *   <ons-speed-dial-item><ons-ripple></ons-ripple>C</ons-speed-dial-item>
    *   <ons-speed-dial-item><ons-ripple></ons-ripple>B</ons-speed-dial-item>
    *   <ons-speed-dial-item><ons-ripple></ons-ripple>A</ons-speed-dial-item>
    * </ons-speed-dial>
    */

   var SpeedDialItemElement = (function (_BaseElement) {
     babelHelpers.inherits(SpeedDialItemElement, _BaseElement);

     function SpeedDialItemElement() {
       babelHelpers.classCallCheck(this, SpeedDialItemElement);
       return babelHelpers.possibleConstructorReturn(this, Object.getPrototypeOf(SpeedDialItemElement).apply(this, arguments));
     }

     babelHelpers.createClass(SpeedDialItemElement, [{
       key: 'createdCallback',

       /**
        * @attribute modifier
        * @type {String}
        * @description
        *   [en]The appearance of the component.[/en]
        *   [ja]このコンポーネントの表現を指定します。[/ja]
        */

       value: function createdCallback() {
         if (!this.hasAttribute('_compiled')) {
           this._compile();
         }

         this._boundOnClick = this._onClick.bind(this);
       }
     }, {
       key: 'attributeChangedCallback',
       value: function attributeChangedCallback(name, last, current) {
         if (name === 'modifier') {
           return ModifierUtil.onModifierChanged(last, current, this, scheme$13);
         }
       }
     }, {
       key: 'attachedCallback',
       value: function attachedCallback() {
         this.addEventListener('click', this._boundOnClick, false);
       }
     }, {
       key: 'detachedCallback',
       value: function detachedCallback() {
         this.removeEventListener('click', this._boundOnClick, false);
       }
     }, {
       key: '_onClick',
       value: function _onClick(e) {
         e.stopPropagation();
       }
     }, {
       key: '_compile',
       value: function _compile() {
         ons._autoStyle.prepare(this);

         this.classList.add('fab');
         this.classList.add('fab--mini');
         this.classList.add('speed-dial__item');

         if (this.hasAttribute('ripple') && !util.findChild(this, 'ons-ripple')) {
           this.insertBefore(document.createElement('ons-ripple'), this.firstChild);
         }

         ModifierUtil.initModifier(this, scheme$13);

         this.setAttribute('_compiled', '');
       }
     }]);
     return SpeedDialItemElement;
   })(BaseElement);

   window.OnsSpeedDialItemElement = document.registerElement('ons-speed-dial-item', {
     prototype: SpeedDialItemElement.prototype
   });

   var scheme$14 = {
     '': 'speed-dial--*'
   };

   /**
    * @element ons-speed-dial
    * @category speeddial
    * @description
    *   [en]Element that displays a Material Design Speed Dialog component.[/en]
    *   [ja]Material DesignのSpeed dialコンポーネントを表現する要素です。[/ja]
    * @codepen dYQYLg
    * @seealso ons-speed-dial-item
    *   [en]ons-speed-dial-item component[/en]
    *   [ja]ons-speed-dial-itemコンポーネント[/ja]
    * @example
    * <ons-speed-dial position="left bottom">
    *   <ons-icon
    *     icon="fa-twitter"
    *     size="26px"
    *     fixed-width="false"
    *     style="vertical-align:middle;">
    *   </ons-icon>
    *   <ons-speed-dial-item><ons-ripple></ons-ripple>C</ons-speed-dial-item>
    *   <ons-speed-dial-item><ons-ripple></ons-ripple>B</ons-speed-dial-item>
    *   <ons-speed-dial-item><ons-ripple></ons-ripple>A</ons-speed-dial-item>
    * </ons-speed-dial>
    */

   var SpeedDialElement = (function (_BaseElement) {
     babelHelpers.inherits(SpeedDialElement, _BaseElement);

     function SpeedDialElement() {
       babelHelpers.classCallCheck(this, SpeedDialElement);
       return babelHelpers.possibleConstructorReturn(this, Object.getPrototypeOf(SpeedDialElement).apply(this, arguments));
     }

     babelHelpers.createClass(SpeedDialElement, [{
       key: 'createdCallback',

       /**
        * @attribute modifier
        * @type {String}
        * @description
        *   [en]The appearance of the component.[/en]
        *   [ja]このコンポーネントの表現を指定します。[/ja]
        */

       /**
        * @attribute position
        * @type {String}
        * @description
        *   [en]
        *     Specify the vertical and horizontal position of the component.
        *     I.e. to display it in the top right corner specify "right top".
        *     Choose from "right", "left", "top" and "bottom".
        *   [/en]
        *   [ja]
        *     この要素を表示する左右と上下の位置を指定します。
        *     例えば、右上に表示する場合には"right top"を指定します。
        *     左右と上下の位置の指定には、rightとleft、topとbottomがそれぞれ指定できます。
        *   [/ja]
        */

       /**
        * @attribute direction
        * @type {String}
        * @description
        *   [en]Specify the direction the items are displayed. Possible values are "up", "down", "left" and "right".[/en]
        *   [ja]
        *     要素が表示する方向を指定します。up, down, left, rightが指定できます。
        *   [/ja]
        */

       /**
        * @attribute disabled
        * @description
        *   [en]Specify if button should be disabled.[/en]
        *   [ja]無効化する場合に指定します。[/ja]
        */

       value: function createdCallback() {
         if (!this.hasAttribute('_compiled')) {
           this._compile();

           this.classList.add('speed__dial');

           if (this.hasAttribute('direction')) {
             this._updateDirection(this.getAttribute('direction'));
           } else {
             this._updateDirection('up');
           }
           this._updatePosition();

           if (this.hasAttribute('disabled')) {
             this.setDisabled(true);
           }
         }

         this._shown = true;
         this._itemShown = false;
         this._boundOnClick = this._onClick.bind(this);
       }
     }, {
       key: '_compile',
       value: function _compile() {
         var content = document.createElement('ons-fab');

         util.arrayFrom(this.childNodes).forEach(function (node) {
           if (node.nodeType == 8 || node.nodeType === 3 && !/\S/.test(node.nodeValue)) {
             node.remove();
           } else if (node.nodeName.toLowerCase() !== 'ons-speed-dial-item') {
             content.firstChild.appendChild(node);
           }
         });

         this.insertBefore(content, this.firstChild);

         ModifierUtil.initModifier(this, scheme$14);

         this.setAttribute('_compiled', '');
       }
     }, {
       key: 'attributeChangedCallback',
       value: function attributeChangedCallback(name, last, current) {
         if (name === 'modifier') {
           return ModifierUtil.onModifierChanged(last, current, this, scheme$14);
         } else if (name === 'direction') {
           this._updateDirection(current);
         } else if (name === 'position') {
           this._updatePosition();
         } else if (name === 'disabled') {
           if (current !== null) {
             this.setDisabled(true);
           } else {
             this.setDisabled(false);
           }
         }
       }
     }, {
       key: 'attachedCallback',
       value: function attachedCallback() {
         this.addEventListener('click', this._boundOnClick, false);
       }
     }, {
       key: 'detachedCallback',
       value: function detachedCallback() {
         this.removeEventListener('click', this._boundOnClick, false);
       }
     }, {
       key: '_onClick',
       value: function _onClick(e) {
         if (!this.isDisabled()) {
           this.toggleItems();
         }
       }
     }, {
       key: '_show',
       value: function _show() {
         if (!this.isInline()) {
           this.show();
         }
       }
     }, {
       key: '_hide',
       value: function _hide() {
         if (!this.isInline()) {
           this.hide();
         }
       }
     }, {
       key: '_updateDirection',
       value: function _updateDirection(direction) {
         var children = this.items;
         for (var i = 0; i < children.length; i++) {
           children[i].style.transitionDelay = 25 * i + 'ms';
           children[i].style.webkitTransitionDelay = 25 * i + 'ms';
           children[i].style.bottom = 'auto';
           children[i].style.right = 'auto';
           children[i].style.top = 'auto';
           children[i].style.left = 'auto';
         }
         switch (direction) {
           case 'up':
             for (var i = 0; i < children.length; i++) {
               children[i].style.bottom = 72 + 56 * i + 'px';
               children[i].style.right = '8px';
             }
             break;
           case 'down':
             for (var i = 0; i < children.length; i++) {
               children[i].style.top = 72 + 56 * i + 'px';
               children[i].style.left = '8px';
             }
             break;
           case 'left':
             for (var i = 0; i < children.length; i++) {
               children[i].style.top = '8px';
               children[i].style.right = 72 + 56 * i + 'px';
             }
             break;
           case 'right':
             for (var i = 0; i < children.length; i++) {
               children[i].style.top = '8px';
               children[i].style.left = 72 + 56 * i + 'px';
             }
             break;
           default:
             throw new Error('Argument must be one of up, down, left or right.');
         }
       }
     }, {
       key: '_updatePosition',
       value: function _updatePosition() {
         var position = this.getAttribute('position');
         this.classList.remove('fab--top__left', 'fab--bottom__right', 'fab--bottom__left', 'fab--top__right', 'fab--top__center', 'fab--bottom__center');
         switch (position) {
           case 'top right':
           case 'right top':
             this.classList.add('fab--top__right');
             break;
           case 'top left':
           case 'left top':
             this.classList.add('fab--top__left');
             break;
           case 'bottom right':
           case 'right bottom':
             this.classList.add('fab--bottom__right');
             break;
           case 'bottom left':
           case 'left bottom':
             this.classList.add('fab--bottom__left');
             break;
           case 'center top':
           case 'top center':
             this.classList.add('fab--top__center');
             break;
           case 'center bottom':
           case 'bottom center':
             this.classList.add('fab--bottom__center');
             break;
           default:
             break;
         }
       }

       /**
        * @method show
        * @signature show()
        * @description
        *   [en]Show the speed dial.[/en]
        *   [ja]Speed dialを表示します。[/ja]
        */

     }, {
       key: 'show',
       value: function show() {
         var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

         this.querySelector('ons-fab').show();
         this._shown = true;
       }

       /**
        * @method hide
        * @signature hide()
        * @description
        *   [en]Hide the speed dial.[/en]
        *   [ja]Speed dialを非表示にします。[/ja]
        */

     }, {
       key: 'hide',
       value: function hide() {
         var _this2 = this;

         var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

         this.hideItems();
         setTimeout(function () {
           _this2.querySelector('ons-fab').hide();
         }, 200);
         this._shown = false;
       }

       /**
        * @method showItems
        * @signature showItems()
        * @description
        *   [en]Show the speed dial items.[/en]
        *   [ja]Speed dialの子要素を表示します。[/ja]
        */

     }, {
       key: 'showItems',
       value: function showItems() {
         if (!this._itemShown) {
           var children = this.items;
           for (var i = 0; i < children.length; i++) {
             children[i].style.transform = 'scale(1)';
             children[i].style.webkitTransform = 'scale(1)';
             children[i].style.transitionDelay = 25 * i + 'ms';
             children[i].style.webkitTransitionDelay = 25 * i + 'ms';
           }
         }
         this._itemShown = true;
       }

       /**
        * @method hideItems
        * @signature hideItems()
        * @description
        *   [en]Hide the speed dial items.[/en]
        *   [ja]Speed dialの子要素を非表示にします。[/ja]
        */

     }, {
       key: 'hideItems',
       value: function hideItems() {
         if (this._itemShown) {
           var children = this.items;
           for (var i = 0; i < children.length; i++) {
             children[i].style.transform = 'scale(0)';
             children[i].style.webkitTransform = 'scale(0)';
             children[i].style.transitionDelay = 25 * (children.length - i) + 'ms';
             children[i].style.webkitTransitionDelay = 25 * (children.length - i) + 'ms';
           }
         }
         this._itemShown = false;
       }

       /**
        * @method setDisabled
        * @signature setDisabled(disabled)
        * @param {Boolean}
        * @description
        *   [en]Disable or enable the element.[/en]
        *   [ja]disabled状態にするかどうかを設定します。[/ja]
        */

     }, {
       key: 'setDisabled',
       value: function setDisabled(disabled) {
         if (typeof disabled !== 'boolean') {
           throw new Error('Argument must be a boolean.');
         }

         if (disabled) {
           this.hideItems();
           this.setAttribute('disabled', '');
           util.arrayFrom(this.childNodes).forEach(function (element) {
             return element.classList.contains('fab') ? element.setAttribute('disabled', '') : true;
           });
         } else {
           this.removeAttribute('disabled');
           util.arrayFrom(this.childNodes).forEach(function (element) {
             return element.classList.contains('fab') ? element.removeAttribute('disabled') : true;
           });
         }
       }

       /**
        * @method isDisabled
        * @signature isDisabled()
        * @return {Boolean}
        *   [en]true if the element is disabled.[/en]
        *   [ja]disabled状態になっているかどうかを返します。[/ja]
        * @description
        *   [en]Returns whether the component is enabled or not.[/en]
        *   [ja]この要素を無効化するかどうかを指定します。[/ja]
        */

     }, {
       key: 'isDisabled',
       value: function isDisabled() {
         return this.hasAttribute('disabled');
       }

       /**
        * @method isInline
        * @signature isInline()
        * @return {Boolean}
        * @description
        *   [en]Returns whether the component is inline or not.[/en]
        *   [ja]この要素がインライン要素かどうかを返します。[/ja]
        */

     }, {
       key: 'isInline',
       value: function isInline() {
         return this.hasAttribute('inline');
       }

       /**
        * @method isShown
        * @signature isShown()
        * @return {Boolean}
        *   [en]True if the component is visible.[/en]
        *   [ja]表示されているかどうかを返します。[/ja]
        * @description
        *   [en]Return whether the component is visible or not.[/en]
        *   [ja]表示されているかどうかを返します。[/ja]
        */

     }, {
       key: 'isShown',
       value: function isShown() {
         return this._shown && this.style.display !== 'none';
       }
     }, {
       key: 'isItemShown',
       value: function isItemShown() {
         return this._itemShown;
       }

       /**
        * @method toggle
        * @signature toggle()
        * @description
        *   [en]Toggle visibility.[/en]
        *   [ja]Speed dialの表示非表示を切り替えます。[/ja]
        */

     }, {
       key: 'toggle',
       value: function toggle() {
         if (this.isShown()) {
           this.hide();
         } else {
           this.show();
         }
       }

       /**
        * @method toggleItems
        * @signature toggleItems()
        * @description
        *   [en]Toggle item visibility.[/en]
        *   [ja]Speed dialの子要素の表示非表示を切り替えます。[/ja]
        */

     }, {
       key: 'toggleItems',
       value: function toggleItems() {
         if (this.isItemShown()) {
           this.hideItems();
         } else {
           this.showItems();
         }
       }
     }, {
       key: 'items',
       get: function get() {
         return util.arrayFrom(this.querySelectorAll('ons-speed-dial-item'));
       }
     }]);
     return SpeedDialElement;
   })(BaseElement);

   window.OnsSpeedDialElement = document.registerElement('ons-speed-dial', {
     prototype: SpeedDialElement.prototype
   });

   var rewritables = {
     /**
      * @param {Element} splitterSideElement
      * @param {Function} callback
      */

     ready: function ready(splitterSideElement, callback) {
       setImmediate(callback);
     },

     /**
      * @param {Element} splitterSideElement
      * @param {HTMLFragment} target
      * @param {Object} options
      * @param {Function} callback
      */
     link: function link(splitterSideElement, target, options, callback) {
       callback(target);
     }
   };

   /**
    * @element ons-splitter-content
    * @category control
    * @description
    *  [en]The "ons-splitter-content" element is used as a child element of "ons-splitter".[/en]
    *  [ja]ons-splitter-content要素は、ons-splitter要素の子要素として利用します。[/ja]
    * @codepen rOQOML
    * @seealso ons-splitter
    *  [en]ons-splitter component[/en]
    *  [ja]ons-splitterコンポーネント[/ja]
    * @seealso ons-splitter-side
    *  [en]ons-splitter-side component[/en]
    *  [ja]ons-splitter-sideコンポーネント[/ja]
    * @example
    * <ons-splitter>
    *   <ons-splitter-content>
    *     ...
    *   </ons-splitter-content>
    *
    *   <ons-splitter-side side="left" width="80%" collapse>
    *     ...
    *   </ons-splitter-side>
    * </ons-splitter>
    */

   var SplitterContentElement = (function (_BaseElement) {
     babelHelpers.inherits(SplitterContentElement, _BaseElement);

     function SplitterContentElement() {
       babelHelpers.classCallCheck(this, SplitterContentElement);
       return babelHelpers.possibleConstructorReturn(this, Object.getPrototypeOf(SplitterContentElement).apply(this, arguments));
     }

     babelHelpers.createClass(SplitterContentElement, [{
       key: 'createdCallback',
       value: function createdCallback() {
         this._page = null;
       }

       /**
        * @method load
        * @signature load(pageUrl)
        * @param {String} pageUrl
        *   [en]Page URL. Can be either an HTML document or an <ons-template>.[/en]
        *   [ja]pageのURLか、ons-templateで宣言したテンプレートのid属性の値を指定します。[/ja]
        * @param {Object} [options]
        * @param {Function} [options.callback]
        * @description
        *   [en]Show the page specified in pageUrl in the right section[/en]
        *   [ja]指定したURLをメインページを読み込みます。[/ja]
        * @return {Promise}
        *   [en]Resolves to the new page element[/en]
        *   [ja][/ja]
        */

     }, {
       key: 'load',
       value: function load(page) {
         var _this2 = this;

         var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

         this._page = page;

         options.callback = options.callback instanceof Function ? options.callback : function () {};
         return internal.getPageHTMLAsync(page).then(function (html) {
           return new Promise(function (resolve) {
             rewritables.link(_this2, util.createFragment(html), options, function (fragment) {
               util.propagateAction(_this2, '_hide');
               _this2.innerHTML = '';

               _this2.appendChild(fragment);

               util.propagateAction(_this2, '_show');

               options.callback();
               resolve(_this2.firstChild);
             });
           });
         });
       }
     }, {
       key: 'attachedCallback',
       value: function attachedCallback() {
         var _this3 = this;

         this._assertParent();

         if (this.hasAttribute('page')) {
           setImmediate(function () {
             return rewritables.ready(_this3, function () {
               return _this3.load(_this3.getAttribute('page'));
             });
           });
         }
       }
     }, {
       key: 'detachedCallback',
       value: function detachedCallback() {}
     }, {
       key: '_show',
       value: function _show() {
         util.propagateAction(this, '_show');
       }
     }, {
       key: '_hide',
       value: function _hide() {
         util.propagateAction(this, '_hide');
       }
     }, {
       key: '_destroy',
       value: function _destroy() {
         util.propagateAction(this, '_destroy');
         this.remove();
       }
     }, {
       key: '_assertParent',
       value: function _assertParent() {
         var parentElementName = this.parentElement.nodeName.toLowerCase();
         if (parentElementName !== 'ons-splitter') {
           throw new Error('"' + parentElementName + '" element is not allowed as parent element.');
         }
       }
     }, {
       key: 'page',

       /**
        * @attribute page
        * @initonly
        * @type {String}
        * @description
        *   [en]The url of the menu page.[/en]
        *   [ja]ons-splitter-side要素に表示するページのURLを指定します。[/ja]
        */

       get: function get() {
         return this._page;
       }
     }]);
     return SplitterContentElement;
   })(BaseElement);

   window.OnsSplitterContentElement = document.registerElement('ons-splitter-content', {
     prototype: SplitterContentElement.prototype
   });

   window.OnsSplitterContentElement.rewritables = rewritables;

   var SplitterMaskElement = (function (_BaseElement) {
     babelHelpers.inherits(SplitterMaskElement, _BaseElement);

     function SplitterMaskElement() {
       babelHelpers.classCallCheck(this, SplitterMaskElement);
       return babelHelpers.possibleConstructorReturn(this, Object.getPrototypeOf(SplitterMaskElement).apply(this, arguments));
     }

     babelHelpers.createClass(SplitterMaskElement, [{
       key: 'createdCallback',
       value: function createdCallback() {
         this._boundOnClick = this._onClick.bind(this);
       }
     }, {
       key: '_onClick',
       value: function _onClick(event) {
         if (this.parentElement && this.parentElement.nodeName.toLowerCase() === 'ons-splitter') {
           // close side menus
           this.parentElement.closeRight().catch(function () {});
           this.parentElement.closeLeft().catch(function () {});
         }
         event.stopPropagation();
       }
     }, {
       key: 'attributeChangedCallback',
       value: function attributeChangedCallback(name, last, current) {}
     }, {
       key: 'attachedCallback',
       value: function attachedCallback() {
         this.addEventListener('click', this._boundOnClick);
       }
     }, {
       key: 'detachedCallback',
       value: function detachedCallback() {
         this.removeEventListener('click', this._boundOnClick);
       }
     }]);
     return SplitterMaskElement;
   })(BaseElement);

   window.OnsSplitterMaskElement = document.registerElement('ons-splitter-mask', {
     prototype: SplitterMaskElement.prototype
   });

   var SplitterAnimator = (function () {
     function SplitterAnimator() {
       var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];
       babelHelpers.classCallCheck(this, SplitterAnimator);

       options = util.extend({
         timing: 'linear',
         duration: '0.3',
         delay: '0'
       }, options || {});

       this._timing = options.timing;
       this._duration = options.duration;
       this._delay = options.delay;
     }

     babelHelpers.createClass(SplitterAnimator, [{
       key: 'layoutOnOpen',
       value: function layoutOnOpen() {}
     }, {
       key: 'layoutOnClose',
       value: function layoutOnClose() {}
     }, {
       key: 'translate',
       value: function translate(distance) {}
     }, {
       key: 'open',
       value: function open(done) {
         done();
       }
     }, {
       key: 'close',
       value: function close(done) {
         done();
       }
     }, {
       key: 'activate',
       value: function activate(contentElement, sideElement, maskElement) {}
     }, {
       key: 'inactivate',
       value: function inactivate() {}
     }, {
       key: 'isActivated',
       value: function isActivated() {
         throw new Error();
       }
     }]);
     return SplitterAnimator;
   })();

   var SPLIT_MODE = 'split';
   var COLLAPSE_MODE = 'collapse';

   var CollapseDetection = (function () {
     function CollapseDetection() {
       babelHelpers.classCallCheck(this, CollapseDetection);
     }

     babelHelpers.createClass(CollapseDetection, [{
       key: 'activate',
       value: function activate(element) {}
     }, {
       key: 'inactivate',
       value: function inactivate() {}
     }]);
     return CollapseDetection;
   })();

   var rewritables$1 = {
     /**
      * @param {Element} splitterSideElement
      * @param {Function} callback
      */

     ready: function ready(splitterSideElement, callback) {
       setImmediate(callback);
     },

     /**
      * @param {Element} splitterSideElement
      * @param {HTMLFragment} target
      * @param {Object} options
      * @param {Function} callback
      */
     link: function link(splitterSideElement, target, options, callback) {
       callback(target);
     }
   };

   var OrientationCollapseDetection = (function (_CollapseDetection) {
     babelHelpers.inherits(OrientationCollapseDetection, _CollapseDetection);

     /**
      * @param {String} orientation
      */

     function OrientationCollapseDetection(orientation) {
       babelHelpers.classCallCheck(this, OrientationCollapseDetection);

       var _this = babelHelpers.possibleConstructorReturn(this, Object.getPrototypeOf(OrientationCollapseDetection).call(this));

       if (orientation !== 'portrait' && orientation !== 'landscape') {
         throw new Error('Invalid orientation: ' + orientation);
       }

       _this._boundOnOrientationChange = _this._onOrientationChange.bind(_this);
       _this._targetOrientation = orientation;
       return _this;
     }

     babelHelpers.createClass(OrientationCollapseDetection, [{
       key: 'activate',
       value: function activate(element) {
         this._element = element;
         ons.orientation.on('change', this._boundOnOrientationChange);
         this._update(ons.orientation.isPortrait());
       }
     }, {
       key: '_onOrientationChange',
       value: function _onOrientationChange(info) {
         this._update(info.isPortrait);
       }
     }, {
       key: '_update',
       value: function _update(isPortrait) {
         if (isPortrait && this._targetOrientation === 'portrait') {
           this._element._updateMode(COLLAPSE_MODE);
         } else if (!isPortrait && this._targetOrientation === 'landscape') {
           this._element._updateMode(COLLAPSE_MODE);
         } else {
           this._element._updateMode(SPLIT_MODE);
         }
       }
     }, {
       key: 'inactivate',
       value: function inactivate() {
         this._element = null;
         ons.orientation.off('change', this._boundOnOrientationChange);
       }
     }]);
     return OrientationCollapseDetection;
   })(CollapseDetection);

   var StaticCollapseDetection = (function (_CollapseDetection2) {
     babelHelpers.inherits(StaticCollapseDetection, _CollapseDetection2);

     function StaticCollapseDetection() {
       babelHelpers.classCallCheck(this, StaticCollapseDetection);
       return babelHelpers.possibleConstructorReturn(this, Object.getPrototypeOf(StaticCollapseDetection).apply(this, arguments));
     }

     babelHelpers.createClass(StaticCollapseDetection, [{
       key: 'activate',
       value: function activate(element) {
         element._updateMode(COLLAPSE_MODE);
       }
     }]);
     return StaticCollapseDetection;
   })(CollapseDetection);

   var MediaQueryCollapseDetection = (function (_CollapseDetection3) {
     babelHelpers.inherits(MediaQueryCollapseDetection, _CollapseDetection3);

     /**
      * @param {String} query
      */

     function MediaQueryCollapseDetection(query) {
       babelHelpers.classCallCheck(this, MediaQueryCollapseDetection);

       var _this3 = babelHelpers.possibleConstructorReturn(this, Object.getPrototypeOf(MediaQueryCollapseDetection).call(this));

       _this3._mediaQueryString = query;
       _this3._boundOnChange = _this3._onChange.bind(_this3);
       return _this3;
     }

     babelHelpers.createClass(MediaQueryCollapseDetection, [{
       key: '_onChange',
       value: function _onChange(queryList) {
         this._element._updateMode(queryList.matches ? COLLAPSE_MODE : SPLIT_MODE);
       }
     }, {
       key: 'activate',
       value: function activate(element) {
         this._element = element;
         this._queryResult = window.matchMedia(this._mediaQueryString);
         this._queryResult.addListener(this._boundOnChange);
         this._onChange(this._queryResult);
       }
     }, {
       key: 'inactivate',
       value: function inactivate() {
         this._element = null;
         this._queryResult.removeListener(this._boundOnChange);
         this._queryResult = null;
       }
     }]);
     return MediaQueryCollapseDetection;
   })(CollapseDetection);

   var BaseMode = (function () {
     function BaseMode() {
       babelHelpers.classCallCheck(this, BaseMode);
     }

     babelHelpers.createClass(BaseMode, [{
       key: 'isOpen',
       value: function isOpen() {
         return false;
       }
     }, {
       key: 'openMenu',
       value: function openMenu() {
         return false;
       }
     }, {
       key: 'closeMenu',
       value: function closeMenu() {
         return false;
       }
     }, {
       key: 'enterMode',
       value: function enterMode() {}
     }, {
       key: 'exitMode',
       value: function exitMode() {}
     }, {
       key: 'handleGesture',
       value: function handleGesture() {}
     }]);
     return BaseMode;
   })();

   var SplitMode = (function (_BaseMode) {
     babelHelpers.inherits(SplitMode, _BaseMode);

     function SplitMode(element) {
       babelHelpers.classCallCheck(this, SplitMode);

       var _this4 = babelHelpers.possibleConstructorReturn(this, Object.getPrototypeOf(SplitMode).call(this));

       _this4._element = element;
       return _this4;
     }

     babelHelpers.createClass(SplitMode, [{
       key: 'isOpen',
       value: function isOpen() {
         return false;
       }
     }, {
       key: 'openMenu',
       value: function openMenu() {
         return Promise.reject('Not possible in Split Mode');
       }
     }, {
       key: 'closeMenu',
       value: function closeMenu() {
         return Promise.reject('Not possible in Split Mode');
       }

       /**
        * @param {Element} element
        */

     }, {
       key: 'layout',
       value: function layout() {
         var element = this._element;
         element.style.width = element._getWidth();

         if (element._isLeftSide()) {
           element.style.left = '0';
           element.style.right = 'auto';
         } else {
           element.style.left = 'auto';
           element.style.right = '0';
         }
       }
     }, {
       key: 'enterMode',
       value: function enterMode() {
         this.layout();
       }
     }, {
       key: 'exitMode',
       value: function exitMode() {
         var element = this._element;

         element.style.left = '';
         element.style.right = '';
         element.style.width = '';
         element.style.zIndex = '';
       }
     }]);
     return SplitMode;
   })(BaseMode);

   var CollapseMode = (function (_BaseMode2) {
     babelHelpers.inherits(CollapseMode, _BaseMode2);
     babelHelpers.createClass(CollapseMode, [{
       key: '_animator',
       get: function get() {
         return this._element._getAnimator();
       }
     }], [{
       key: 'CLOSED_STATE',
       get: function get() {
         return 'closed';
       }
     }, {
       key: 'OPEN_STATE',
       get: function get() {
         return 'open';
       }
     }, {
       key: 'CHANGING_STATE',
       get: function get() {
         return 'changing';
       }
     }]);

     function CollapseMode(element) {
       babelHelpers.classCallCheck(this, CollapseMode);

       var _this5 = babelHelpers.possibleConstructorReturn(this, Object.getPrototypeOf(CollapseMode).call(this));

       _this5._state = CollapseMode.CLOSED_STATE;
       _this5._distance = 0;
       _this5._element = element;
       _this5._lock = new DoorLock();
       return _this5;
     }

     babelHelpers.createClass(CollapseMode, [{
       key: '_isLocked',
       value: function _isLocked() {
         return this._lock.isLocked();
       }
     }, {
       key: 'isOpen',
       value: function isOpen() {
         return this._state !== CollapseMode.CLOSED_STATE;
       }
     }, {
       key: 'isClosed',
       value: function isClosed() {
         return this._state === CollapseMode.CLOSED_STATE;
       }
     }, {
       key: 'handleGesture',
       value: function handleGesture(event) {
         if (this._isLocked()) {
           return;
         }

         if (this._isOpenOtherSideMenu()) {
           return;
         }

         if (event.type === 'dragstart') {
           this._onDragStart(event);
         } else if (event.type === 'dragleft' || event.type === 'dragright') {
           if (!this._ignoreDrag) {
             this._onDrag(event);
           }
         } else if (event.type === 'dragend') {
           if (!this._ignoreDrag) {
             this._onDragEnd(event);
           }
         } else {
           throw new Error('Invalid state');
         }
       }
     }, {
       key: '_onDragStart',
       value: function _onDragStart(event) {
         this._ignoreDrag = ['left', 'right'].indexOf(event.gesture.direction) === -1;

         if (!this.isOpen() && this._isOpenOtherSideMenu()) {
           this._ignoreDrag = true;
         } else if (this._element._swipeTargetWidth > 0) {
           var distance = this._element._isLeftSide() ? event.gesture.center.clientX : window.innerWidth - event.gesture.center.clientX;
           if (!this.isOpen() && distance > this._element._swipeTargetWidth) {
             this._ignoreDrag = true;
           }
         }
       }
     }, {
       key: '_onDrag',
       value: function _onDrag(event) {
         event.gesture.preventDefault();

         var deltaX = event.gesture.deltaX;
         var deltaDistance = this._element._isLeftSide() ? deltaX : -deltaX;

         var startEvent = event.gesture.startEvent;

         if (!('isOpen' in startEvent)) {
           startEvent.isOpen = this.isOpen();
           startEvent.distance = startEvent.isOpen ? this._element._getWidthInPixel() : 0;
           startEvent.width = this._element._getWidthInPixel();
         }

         var width = this._element._getWidthInPixel();

         if (deltaDistance < 0 && startEvent.distance <= 0) {
           return;
         }

         if (deltaDistance > 0 && startEvent.distance >= width) {
           return;
         }

         var distance = startEvent.isOpen ? deltaDistance + width : deltaDistance;
         var normalizedDistance = Math.max(0, Math.min(width, distance));

         startEvent.distance = normalizedDistance;

         this._state = CollapseMode.CHANGING_STATE;
         this._animator.translate(normalizedDistance);
       }
     }, {
       key: '_onDragEnd',
       value: function _onDragEnd(event) {
         var deltaX = event.gesture.deltaX;
         var deltaDistance = this._element._isLeftSide() ? deltaX : -deltaX;
         var width = event.gesture.startEvent.width;
         var distance = event.gesture.startEvent.isOpen ? deltaDistance + width : deltaDistance;
         var direction = event.gesture.interimDirection;
         var shouldOpen = this._element._isLeftSide() && direction === 'right' && distance > width * this._element._getThresholdRatioIfShouldOpen() || !this._element._isLeftSide() && direction === 'left' && distance > width * this._element._getThresholdRatioIfShouldOpen();

         if (shouldOpen) {
           this._openMenu();
         } else {
           this._closeMenu();
         }
       }
     }, {
       key: 'layout',
       value: function layout() {

         if (this._state === CollapseMode.CHANGING_STATE) {
           return;
         }

         if (this._state === CollapseMode.CLOSED_STATE) {
           if (this._animator.isActivated()) {
             this._animator.layoutOnClose();
           }
         } else if (this._state === CollapseMode.OPEN_STATE) {
           if (this._animator.isActivated()) {
             this._animator.layoutOnOpen();
           }
         } else {
           throw new Error('Invalid state');
         }
       }

       // enter collapse mode

     }, {
       key: 'enterMode',
       value: function enterMode() {
         this._animator.activate(this._element._getContentElement(), this._element, this._element._getMaskElement());

         this.layout();
       }

       // exit collapse mode

     }, {
       key: 'exitMode',
       value: function exitMode() {
         this._animator.inactivate();
       }

       /**
        * @return {Boolean}
        */

     }, {
       key: '_isOpenOtherSideMenu',
       value: function _isOpenOtherSideMenu() {
         var _this6 = this;

         return util.arrayFrom(this._element.parentElement.children).filter(function (child) {
           return child.nodeName.toLowerCase() === 'ons-splitter-side' && _this6._element !== child;
         }).filter(function (side) {
           return side.isOpen();
         }).length > 0;
       }

       /**
        * @param {Object} [options]
        * @param {Function} [options.callback]
        * @param {Boolean} [options.withoutAnimation]
        * @return {Promise} Resolves to the splitter side element
        */

     }, {
       key: 'openMenu',
       value: function openMenu() {
         var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

         if (this._state !== CollapseMode.CLOSED_STATE) {
           return Promise.reject('Not in Collapse Mode.');
         }

         return this._openMenu(options);
       }

       /**
        * @param {Object} [options]
        * @param {Function} [options.callback]
        * @param {Boolean} [options.withoutAnimation]
        * @return {Promise} Resolves to the splitter side element
        */

     }, {
       key: '_openMenu',
       value: function _openMenu() {
         var _this7 = this;

         var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

         if (this._isLocked()) {
           return Promise.reject('Splitter side is locked.');
         }

         if (this._isOpenOtherSideMenu()) {
           return Promise.reject('Another menu is already open.');
         }

         if (this._element._emitPreOpenEvent()) {
           return Promise.reject('Canceled in preopen event.');
         }

         options.callback = options.callback instanceof Function ? options.callback : function () {};

         var unlock = this._lock.lock();
         var done = function done() {
           unlock();
           _this7._element._emitPostOpenEvent();
           options.callback();
         };

         if (options.withoutAnimation) {
           this._state = CollapseMode.OPEN_STATE;
           this.layout();
           done();
           return Promise.resolve(this._element);
         } else {
           this._state = CollapseMode.CHANGING_STATE;
           return new Promise(function (resolve) {
             _this7._animator.open(function () {
               _this7._state = CollapseMode.OPEN_STATE;
               _this7.layout();
               done();
               resolve(_this7._element);
             });
           });
         }
       }

       /**
        * @param {Object} [options]
        * @return {Promise} Resolves to the splitter side element
        */

     }, {
       key: 'closeMenu',
       value: function closeMenu() {
         var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

         if (this._state !== CollapseMode.OPEN_STATE) {
           return Promise.reject('Not in Collapse Mode.');
         }

         return this._closeMenu(options);
       }

       /**
        * @param {Object} [options]
        * @return {Promise} Resolves to the splitter side element
        */

     }, {
       key: '_closeMenu',
       value: function _closeMenu() {
         var _this8 = this;

         var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

         if (this._isLocked()) {
           return Promise.reject('Splitter side is locked.');
         }

         if (this._element._emitPreCloseEvent()) {
           return Promise.reject('Canceled in preclose event.');
         }

         options.callback = options.callback instanceof Function ? options.callback : function () {};

         var unlock = this._lock.lock();
         var done = function done() {
           unlock();
           _this8._element._emitPostCloseEvent();
           setImmediate(options.callback);
         };

         if (options.withoutAnimation) {
           this._state = CollapseMode.CLOSED_STATE;
           this.layout();
           done();
           return Promise.resolve(this._element);
         } else {
           this._state = CollapseMode.CHANGING_STATE;
           return new Promise(function (resolve) {
             _this8._animator.close(function () {
               _this8._state = CollapseMode.CLOSED_STATE;
               _this8.layout();
               done();
               resolve(_this8._element);
             });
           });
         }
       }
     }]);
     return CollapseMode;
   })(BaseMode);

   /**
    * @element ons-splitter-side
    * @category control
    * @description
    *  [en]The "ons-splitter-side" element is used as a child element of "ons-splitter".[/en]
    *  [ja]ons-splitter-side要素は、ons-splitter要素の子要素として利用します。[/ja]
    * @codepen rOQOML
    * @seealso ons-splitter
    *  [en]ons-splitter component[/en]
    *  [ja]ons-splitterコンポーネント[/ja]
    * @seealso ons-splitter-content
    *  [en]ons-splitter-content component[/en]
    *  [ja]ons-splitter-contentコンポーネント[/ja]
    * @example
    * <ons-splitter>
    *   <ons-splitter-content>
    *     ...
    *   </ons-splitter-content>
    *
    *   <ons-splitter-side side="left" width="80%" collapse>
    *     ...
    *   </ons-splitter-side>
    * </ons-splitter>
    */

   var SplitterSideElement = (function (_BaseElement) {
     babelHelpers.inherits(SplitterSideElement, _BaseElement);

     function SplitterSideElement() {
       babelHelpers.classCallCheck(this, SplitterSideElement);
       return babelHelpers.possibleConstructorReturn(this, Object.getPrototypeOf(SplitterSideElement).apply(this, arguments));
     }

     babelHelpers.createClass(SplitterSideElement, [{
       key: '_updateForAnimationOptionsAttribute',
       value: function _updateForAnimationOptionsAttribute() {
         this._animationOptions = util.parseJSONObjectSafely(this.getAttribute('animation-options'), {});
       }
     }, {
       key: '_getMaskElement',
       value: function _getMaskElement() {
         return util.findChild(this.parentElement, 'ons-splitter-mask');
       }
     }, {
       key: '_getContentElement',
       value: function _getContentElement() {
         return util.findChild(this.parentElement, 'ons-splitter-content');
       }
     }, {
       key: '_getModeStrategy',
       value: function _getModeStrategy() {
         if (this._mode === COLLAPSE_MODE) {
           return this._collapseMode;
         } else if (this._mode === SPLIT_MODE) {
           return this._splitMode;
         }
       }
     }, {
       key: 'createdCallback',
       value: function createdCallback() {
         this._mode = null;
         this._page = null;
         this._isAttached = false;

         this._collapseStrategy = new CollapseDetection();
         this._animatorFactory = new AnimatorFactory({
           animators: window.OnsSplitterElement._animatorDict,
           baseClass: SplitterAnimator,
           baseClassName: 'SplitterAnimator',
           defaultAnimation: this.getAttribute('animation')
         });

         this._collapseMode = new CollapseMode(this);
         this._splitMode = new SplitMode(this);

         this._boundHandleGesture = this._handleGesture.bind(this);

         this._cancelModeDetection = function () {};

         this._updateMode(SPLIT_MODE);

         this._updateForAnimationAttribute();
         this._updateForWidthAttribute();
         this.hasAttribute('side') ? this._updateForSideAttribute() : this.setAttribute('side', 'left');
         this._updateForCollapseAttribute();
         this._updateForSwipeableAttribute();
         this._updateForSwipeTargetWidthAttribute();
         this._updateForAnimationOptionsAttribute();
       }
     }, {
       key: '_getAnimator',
       value: function _getAnimator() {
         return this._animator;
       }

       /**
        * @return {Boolean}
        */

     }, {
       key: 'isSwipeable',
       value: function isSwipeable() {
         return this.hasAttribute('swipeable');
       }
     }, {
       key: '_emitPostOpenEvent',
       value: function _emitPostOpenEvent() {
         util.triggerElementEvent(this, 'postopen', { side: this });
       }
     }, {
       key: '_emitPostCloseEvent',
       value: function _emitPostCloseEvent() {
         util.triggerElementEvent(this, 'postclose', { side: this });
       }

       /**
        * @return {boolean} canceled or not
        */

     }, {
       key: '_emitPreOpenEvent',
       value: function _emitPreOpenEvent() {
         return this._emitCancelableEvent('preopen');
       }
     }, {
       key: '_emitCancelableEvent',
       value: function _emitCancelableEvent(name) {
         var isCanceled = false;

         util.triggerElementEvent(this, name, {
           side: this,
           cancel: function cancel() {
             return isCanceled = true;
           }
         });

         return isCanceled;
       }

       /**
        * @return {boolean}
        */

     }, {
       key: '_emitPreCloseEvent',
       value: function _emitPreCloseEvent() {
         return this._emitCancelableEvent('preclose');
       }
     }, {
       key: '_updateForCollapseAttribute',
       value: function _updateForCollapseAttribute() {
         if (!this.hasAttribute('collapse')) {
           this._updateMode(SPLIT_MODE);
           return;
         }

         var collapse = ('' + this.getAttribute('collapse')).trim();

         if (collapse === '') {
           this._updateCollapseStrategy(new StaticCollapseDetection());
         } else if (collapse === 'portrait' || collapse === 'landscape') {
           this._updateCollapseStrategy(new OrientationCollapseDetection(collapse));
         } else {
           this._updateCollapseStrategy(new MediaQueryCollapseDetection(collapse));
         }
       }

       /**
        * @param {CollapseDetection} strategy
        */

     }, {
       key: '_updateCollapseStrategy',
       value: function _updateCollapseStrategy(strategy) {
         if (this._isAttached) {
           this._collapseStrategy.inactivate();
           strategy.activate(this);
         }

         this._collapseStrategy = strategy;
       }

       /**
        * @param {String} mode
        */

     }, {
       key: '_updateMode',
       value: function _updateMode(mode) {

         if (mode !== COLLAPSE_MODE && mode !== SPLIT_MODE) {
           throw new Error('invalid mode: ' + mode);
         }

         if (mode === this._mode) {
           return;
         }

         var lastMode = this._getModeStrategy();

         if (lastMode) {
           lastMode.exitMode();
         }

         this._mode = mode;
         var currentMode = this._getModeStrategy();

         currentMode.enterMode();
         this.setAttribute('mode', mode);

         util.triggerElementEvent(this, 'modechange', {
           side: this,
           mode: mode
         });
       }
     }, {
       key: '_getThresholdRatioIfShouldOpen',
       value: function _getThresholdRatioIfShouldOpen() {
         if (this.hasAttribute('threshold-ratio-should-open')) {
           var value = parseFloat(this.getAttribute('threshold-ratio-should-open'));
           return Math.max(0.0, Math.min(1.0, value));
         } else {
           // default value
           return 0.3;
         }
       }
     }, {
       key: '_layout',
       value: function _layout() {
         this._getModeStrategy().layout();
       }
     }, {
       key: '_updateForSwipeTargetWidthAttribute',
       value: function _updateForSwipeTargetWidthAttribute() {
         if (this.hasAttribute('swipe-target-width')) {
           this._swipeTargetWidth = Math.max(0, parseInt(this.getAttribute('swipe-target-width'), 10));
         } else {
           this._swipeTargetWidth = -1;
         }
       }

       /**
        * @return {String} \d+(px|%)
        */

     }, {
       key: '_getWidth',
       value: function _getWidth() {
         return this.hasAttribute('width') ? normalize(this.getAttribute('width')) : '80%';

         function normalize(width) {
           width = width.trim();

           if (width.match(/^\d+(px|%)$/)) {
             return width;
           }

           return '80%';
         }
       }
     }, {
       key: '_getWidthInPixel',
       value: function _getWidthInPixel() {
         var width = this._getWidth();

         var _width$match = width.match(/^(\d+)(px|%)$/);

         var _width$match2 = babelHelpers.slicedToArray(_width$match, 3);

         var num = _width$match2[1];
         var unit = _width$match2[2];

         if (unit === 'px') {
           return parseInt(num, 10);
         }

         if (unit === '%') {
           var percent = parseInt(num, 10);

           return Math.round(this.parentElement.offsetWidth * percent / 100);
         }

         throw new Error('Invalid state');
       }

       /**
        * @return {String} 'left' or 'right'.
        */

     }, {
       key: '_getSide',
       value: function _getSide() {
         return normalize(this.getAttribute('side'));

         function normalize(side) {
           side = ('' + side).trim();
           return side === 'left' || side === 'right' ? side : 'left';
         }
       }
     }, {
       key: '_isLeftSide',
       value: function _isLeftSide() {
         return this._getSide() === 'left';
       }
     }, {
       key: '_updateForWidthAttribute',
       value: function _updateForWidthAttribute() {
         this._getModeStrategy().layout();
       }
     }, {
       key: '_updateForSideAttribute',
       value: function _updateForSideAttribute() {
         this._getModeStrategy().layout();
       }

       /**
        * @method getCurrentMode
        * @signature getCurrentMode()
        * @return {String}
        *   [en]Get current mode. Possible values are "collapse" or "split".[/en]
        *   [ja]このons-splitter-side要素の現在のモードを返します。"split"かもしくは"collapse"のどちらかです。[/ja]
        */

     }, {
       key: 'getCurrentMode',
       value: function getCurrentMode() {
         return this._mode;
       }

       /**
        * @return {Boolean}
        */

     }, {
       key: 'isOpen',
       value: function isOpen() {
         return this._getModeStrategy().isOpen();
       }

       /**
        * @method open
        * @signature open([options])
        * @param {Object} [options]
        *   [en]Parameter object.[/en]
        *   [ja]オプションを指定するオブジェクト。[/ja]
        * @param {Function} [options.callback]
        *   [en]This function will be called after the menu has been opened.[/en]
        *   [ja]メニューが開いた後に呼び出される関数オブジェクトを指定します。[/ja]
        * @description
        *   [en]Open menu in collapse mode.[/en]
        *   [ja]collapseモードになっているons-splitterside要素を開きます。[/ja]
        * @return {Promise}
        *   [en]Resolves to the splitter side element[/en]
        *   [ja][/ja]
        */

     }, {
       key: 'open',
       value: function open() {
         var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

         return this._getModeStrategy().openMenu(options);
       }

       /**
        * @method close
        * @signature close([options])
        * @param {Object} [options]
        *   [en]Parameter object.[/en]
        *   [ja]オプションを指定するオブジェクト。[/ja]
        * @param {Function} [options.callback]
        *   [en]This function will be called after the menu has been closed.[/en]
        *   [ja]メニューが閉じた後に呼び出される関数オブジェクトを指定します。[/ja]
        * @description
        *   [en]Close menu in collapse mode.[/en]
        *   [ja]collapseモードになっているons-splitter-side要素を閉じます。[/ja]
        * @return {Promise}
        *   [en]Resolves to the splitter side element[/en]
        *   [ja][/ja]
        */

     }, {
       key: 'close',
       value: function close() {
         var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

         return this._getModeStrategy().closeMenu(options);
       }

       /**
        * @method load
        * @signature load(page, [options])
        * @param {String} page
        *   [en]Page URL. Can be either an HTML document or an <ons-template>.[/en]
        *   [ja]pageのURLか、ons-templateで宣言したテンプレートのid属性の値を指定します。[/ja]
        * @param {Object} [options]
        * @param {Function} [options.callback]
        * @description
        *   [en]Show the page specified in pageUrl in the right section[/en]
        *   [ja]指定したURLをメインページを読み込みます。[/ja]
        * @return {Promise}
        *   [en]Resolves to the new page element[/en]
        *   [ja][/ja]
        */

     }, {
       key: 'load',
       value: function load(page) {
         var _this10 = this;

         var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

         this._page = page;

         options.callback = options.callback instanceof Function ? options.callback : function () {};
         return internal.getPageHTMLAsync(page).then(function (html) {
           return new Promise(function (resolve) {
             rewritables$1.link(_this10, util.createFragment(html), options, function (fragment) {
               util.propagateAction(_this10, '_hide');
               _this10.innerHTML = '';

               _this10.appendChild(fragment);

               util.propagateAction(_this10, '_show');

               options.callback();
               resolve(_this10.firstChild);
             });
           });
         });
       }

       /**
        * @param {Object} [options]
        */

     }, {
       key: 'toggle',
       value: function toggle() {
         var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

         return this.isOpen() ? this.close(options) : this.open(options);
       }
     }, {
       key: 'attributeChangedCallback',
       value: function attributeChangedCallback(name, last, current) {
         if (name === 'width') {
           this._updateForWidthAttribute();
         } else if (name === 'side') {
           this._updateForSideAttribute();
         } else if (name === 'collapse') {
           this._updateForCollapseAttribute();
         } else if (name === 'swipeable') {
           this._updateForSwipeableAttribute();
         } else if (name === 'swipe-target-width') {
           this._updateForSwipeTargetWidthAttribute();
         } else if (name === 'animation-options') {
           this._updateForAnimationOptionsAttribute();
         } else if (name === 'animation') {
           this._updateForAnimationAttribute();
         }
       }
     }, {
       key: '_updateForAnimationAttribute',
       value: function _updateForAnimationAttribute() {
         var isActivated = this._animator && this._animator.isActivated();

         if (isActivated) {
           this._animator.inactivate();
         }

         this._animator = this._createAnimator();

         if (isActivated) {
           this._animator.activate(this._getContentElement(), this, this._getMaskElement());
         }
       }
     }, {
       key: '_updateForSwipeableAttribute',
       value: function _updateForSwipeableAttribute() {
         if (this._gestureDetector) {
           if (this.isSwipeable()) {
             this._gestureDetector.on('dragstart dragleft dragright dragend', this._boundHandleGesture);
           } else {
             this._gestureDetector.off('dragstart dragleft dragright dragend', this._boundHandleGesture);
           }
         }
       }
     }, {
       key: '_assertParent',
       value: function _assertParent() {
         var parentElementName = this.parentElement.nodeName.toLowerCase();
         if (parentElementName !== 'ons-splitter') {
           throw new Error('"' + parentElementName + '" element is not allowed as parent element.');
         }
       }
     }, {
       key: 'attachedCallback',
       value: function attachedCallback() {
         var _this11 = this;

         this._isAttached = true;
         this._collapseStrategy.activate(this);
         this._assertParent();

         this._gestureDetector = new GestureDetector(this.parentElement, { dragMinDistance: 1 });
         this._updateForSwipeableAttribute();

         if (this.hasAttribute('page')) {
           setImmediate(function () {
             return rewritables$1.ready(_this11, function () {
               return _this11.load(_this11.getAttribute('page'));
             });
           });
         }
       }
     }, {
       key: 'detachedCallback',
       value: function detachedCallback() {
         this._isAttached = false;
         this._collapseStrategy.inactivate();

         this._gestureDetector.dispose();
         this._gestureDetector = null;

         this._updateForSwipeableAttribute();
       }
     }, {
       key: '_handleGesture',
       value: function _handleGesture(event) {
         return this._getModeStrategy().handleGesture(event);
       }
     }, {
       key: '_show',
       value: function _show() {
         util.propagateAction(this, '_show');
       }
     }, {
       key: '_hide',
       value: function _hide() {
         util.propagateAction(this, '_hide');
       }
     }, {
       key: '_destroy',
       value: function _destroy() {
         util.propagateAction(this, '_destroy');
         this.remove();
       }
     }, {
       key: '_createAnimator',
       value: function _createAnimator() {
         return this._animatorFactory.newAnimator({
           animation: this.getAttribute('animation'),
           animationOptions: AnimatorFactory.parseAnimationOptionsString(this.getAttribute('animation-options'))
         });
       }
     }, {
       key: 'page',

       /**
        * @event modechange
        * @description
        *   [en]Fired just after the component's mode changes.[/en]
        *   [ja]この要素のモードが変化した際に発火します。[/ja]
        * @param {Object} event
        *   [en]Event object.[/en]
        *   [ja]イベントオブジェクトです。[/ja]
        * @param {Object} event.side
        *   [en]Component object.[/en]
        *   [ja]コンポーネントのオブジェクト。[/ja]
        * @param {String} event.mode
        *   [en]Returns the current mode. Can be either "collapse" or "split".[/en]
        *   [ja]現在のモードを返します。[/ja]
        */

       /**
        * @event preopen
        * @description
        *   [en]Fired just before the sliding menu is opened.[/en]
        *   [ja]スライディングメニューが開く前に発火します。[/ja]
        * @param {Object} event
        *   [en]Event object.[/en]
        *   [ja]イベントオブジェクトです。[/ja]
        * @param {Function} event.cancel
        *   [en]Call to cancel opening sliding menu.[/en]
        *   [ja]スライディングメニューが開くのをキャンセルします。[/ja]
        * @param {Object} event.side
        *   [en]Component object.[/en]
        *   [ja]コンポーネントのオブジェクト。[/ja]
        */

       /**
        * @event postopen
        * @description
        *   [en]Fired just after the sliding menu is opened.[/en]
        *   [ja]スライディングメニューが開いた後に発火します。[/ja]
        * @param {Object} event
        *   [en]Event object.[/en]
        *   [ja]イベントオブジェクトです。[/ja]
        * @param {Object} event.side
        *   [en]Component object.[/en]
        *   [ja]コンポーネントのオブジェクト。[/ja]
        */

       /**
        * @event preclose
        * @description
        *   [en]Fired just before the sliding menu is closed.[/en]
        *   [ja]スライディングメニューが閉じる前に発火します。[/ja]
        * @param {Object} event
        *   [en]Event object.[/en]
        *   [ja]イベントオブジェクトです。[/ja]
        * @param {Object} event.side
        *   [en]Component object.[/en]
        *   [ja]コンポーネントのオブジェクト。[/ja]
        * @param {Function} event.cancel
        *   [en]Call to cancel opening sliding-menu.[/en]
        *   [ja]スライディングメニューが閉じるのをキャンセルします。[/ja]
        */

       /**
        * @event postclose
        * @description
        *   [en]Fired just after the sliding menu is closed.[/en]
        *   [ja]スライディングメニューが閉じた後に発火します。[/ja]
        * @param {Object} event
        *   [en]Event object.[/en]
        *   [ja]イベントオブジェクトです。[/ja]
        * @param {Object} event.side
        *   [en]Component object.[/en]
        *   [ja]コンポーネントのオブジェクト。[/ja]
        */

       /**
        * @attribute animation
        * @initonly
        * @type {String}
        * @description
        *  [en]Specify the animation. Use one of "overlay", and "default".[/en]
        *  [ja]アニメーションを指定します。"overlay", "default"のいずれかを指定できます。[/ja]
        */

       /**
        * @attribute animation-options
        * @type {Expression}
        * @description
        *  [en]Specify the animation's duration, timing and delay with an object literal. E.g. <code>{duration: 0.2, delay: 1, timing: 'ease-in'}</code>[/en]
        *  [ja]アニメーション時のduration, timing, delayをオブジェクトリテラルで指定します。e.g. <code>{duration: 0.2, delay: 1, timing: 'ease-in'}</code>[/ja]
        */

       /**
        * @attribute threshold-ratio-should-open
        * @type {Number}
        * @description
        *  [en]Specify how much the menu needs to be swiped before opening. A value between 0 and 1. Default is 0.3.[/en]
        *  [ja]どのくらいスワイプすればスライディングメニューを開くかどうかの割合を指定します。0から1の間の数値を指定します。スワイプの距離がここで指定した数値掛けるこの要素の幅よりも大きければ、スワイプが終わった時にこの要素を開きます。デフォルトは0.3です。[/ja]
        */

       /**
        * @attribute collapse
        * @type {String}
        * @description
        *   [en]
        *     Specify the collapse behavior. Valid values are "portrait", "landscape" or a media query.
        *     "portrait" or "landscape" means the view will collapse when device is in landscape or portrait orientation.
        *     If the value is a media query, the view will collapse when the media query is true.
        *     If the value is not defined, the view always be in "collapse" mode.
        *   [/en]
        *   [ja]
        *     左側のページを非表示にする条件を指定します。portrait, landscape、width #pxもしくはメディアクエリの指定が可能です。
        *     portraitもしくはlandscapeを指定すると、デバイスの画面が縦向きもしくは横向きになった時に適用されます。
        *     メディアクエリを指定すると、指定したクエリに適合している場合に適用されます。
        *     値に何も指定しない場合には、常にcollapseモードになります。
        *   [/ja]
        */

       /**
        * @attribute swipe-target-width
        * @type {String}
        * @description
        *   [en]The width of swipeable area calculated from the edge (in pixels). Use this to enable swipe only when the finger touch on the screen edge.[/en]
        *   [ja]スワイプの判定領域をピクセル単位で指定します。画面の端から指定した距離に達するとページが表示されます。[/ja]
        */

       /**
        * @attribute width
        * @type {String}
        * @description
        *   [en]Can be specified in either pixels or as a percentage, e.g. "90%" or "200px".[/en]
        *   [ja]この要素の横幅を指定します。pxと%での指定が可能です。eg. 90%, 200px[/ja]
        */

       /**
        * @attribute side
        * @type {String}
        * @description
        *   [en]Specify which side of the screen the ons-splitter-side element is located on. Possible values are "left" (default) and "right".[/en]
        *   [ja]この要素が左か右かを指定します。指定できる値は"left"か"right"のみです。[/ja]
        */

       /**
        * @attribute mode
        * @type {String}
        * @description
        *   [en]Current mode. Possible values are "collapse" or "split". This attribute is read only.[/en]
        *   [ja]現在のモードが設定されます。"collapse"もしくは"split"が指定されます。この属性は読み込み専用です。[/ja]
        */

       /**
        * @attribute page
        * @initonly
        * @type {String}
        * @description
        *   [en]The url of the menu page.[/en]
        *   [ja]ons-splitter-side要素に表示するページのURLを指定します。[/ja]
        */

       /**
        * @attribute swipeable
        * @type {Boolean}
        * @description
        *   [en]Whether to enable swipe interaction on collapse mode.[/en]
        *   [ja]collapseモード時にスワイプ操作を有効にする場合に指定します。[/ja]
        */

       get: function get() {
         return this._page;
       }
     }, {
       key: 'mode',
       get: function get() {
         this._mode;
       }
     }]);
     return SplitterSideElement;
   })(BaseElement);

   window.OnsSplitterSideElement = document.registerElement('ons-splitter-side', {
     prototype: SplitterSideElement.prototype
   });

   window.OnsSplitterSideElement.rewritables = rewritables$1;

   var OverlaySplitterAnimator = (function (_SplitterAnimator) {
     babelHelpers.inherits(OverlaySplitterAnimator, _SplitterAnimator);

     function OverlaySplitterAnimator() {
       var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];
       babelHelpers.classCallCheck(this, OverlaySplitterAnimator);

       options = util.extend({
         timing: 'cubic-bezier(.1, .7, .1, 1)',
         duration: '0.3',
         delay: '0'
       }, options || {});

       return babelHelpers.possibleConstructorReturn(this, Object.getPrototypeOf(OverlaySplitterAnimator).call(this, options));
     }

     babelHelpers.createClass(OverlaySplitterAnimator, [{
       key: 'isActivated',
       value: function isActivated() {
         return this._isActivated;
       }
     }, {
       key: 'layoutOnClose',
       value: function layoutOnClose() {
         animit(this._side).queue({
           transform: 'translateX(0%)',
           width: this._side._getWidth()
         }).play();

         this._mask.style.display = 'none';
       }
     }, {
       key: 'layoutOnOpen',
       value: function layoutOnOpen() {
         animit(this._side).queue({
           transform: 'translate3d(' + (this._side._isLeftSide() ? '' : '-') + '100%, 0px, 0px)',
           width: this._side._getWidth()
         }).play();

         this._mask.style.display = 'block';
       }

       /**
        * @param {Element} contentElement
        * @param {Element} sideElement
        * @param {Element} maskElement
        */

     }, {
       key: 'activate',
       value: function activate(contentElement, sideElement, maskElement) {
         this._isActivated = true;
         this._content = contentElement;
         this._side = sideElement;
         this._mask = maskElement;

         this._setupLayout();
       }
     }, {
       key: 'inactivate',
       value: function inactivate() {
         this._isActivated = false;
         this._clearLayout();
         this._content = this._side = this._mask = null;
       }

       /**
        * @param {Number} distance
        */

     }, {
       key: 'translate',
       value: function translate(distance) {
         animit(this._side).queue({
           transform: 'translate3d(' + (this._side._isLeftSide() ? '' : '-') + distance + 'px, 0px, 0px)'
         }).play();
       }
     }, {
       key: '_clearLayout',
       value: function _clearLayout() {
         var side = this._side;
         var mask = this._mask;

         side.style.zIndex = '';
         side.style.right = '';
         side.style.left = '';
         side.style.transform = side.style.webkitTransform = '';
         side.style.transition = side.style.webkitTransition = '';
         side.style.width = '';
         side.style.display = '';

         mask.style.display = 'none';
       }
     }, {
       key: '_setupLayout',
       value: function _setupLayout() {
         var side = this._side;

         side.style.zIndex = 3;
         side.style.display = 'block';

         if (side._isLeftSide()) {
           side.style.left = 'auto';
           side.style.right = '100%';
         } else {
           side.style.left = '100%';
           side.style.right = 'auto';
         }
       }

       /**
        * @param {Function} done
        */

     }, {
       key: 'open',
       value: function open(done) {
         var transform = this._side._isLeftSide() ? 'translate3d(100%, 0px, 0px)' : 'translate3d(-100%, 0px, 0px)';

         animit.runAll(animit(this._side).wait(this._delay).queue({
           transform: transform
         }, {
           duration: this._duration,
           timing: this._timing
         }).queue(function (callback) {
           callback();
           done();
         }), animit(this._mask).wait(this._delay).queue({
           display: 'block'
         }).queue({
           opacity: '1'
         }, {
           duration: this._duration,
           timing: 'linear'
         }));
       }

       /**
        * @param {Function} done
        */

     }, {
       key: 'close',
       value: function close(done) {
         var _this2 = this;

         animit.runAll(animit(this._side).wait(this._delay).queue({
           transform: 'translate3d(0px, 0px, 0px)'
         }, {
           duration: this._duration,
           timing: this._timing
         }).queue(function (callback) {
           _this2._side.style.webkitTransition = '';
           done();
           callback();
         }), animit(this._mask).wait(this._delay).queue({
           opacity: '0'
         }, {
           duration: this._duration,
           timing: 'linear'
         }).queue({
           display: 'none'
         }));
       }
     }]);
     return OverlaySplitterAnimator;
   })(SplitterAnimator);

   /**
    * @element ons-splitter
    * @category control
    * @description
    *  [en]A component that enables responsive layout by implementing both a two-column layout and a sliding menu layout.[/en]
    *  [ja]sliding-menuとsplit-view両方の機能を持つレイアウトです。[/ja]
    * @codepen rOQOML
    * @seealso ons-splitter-content
    *  [en]ons-splitter-content component[/en]
    *  [ja]ons-splitter-contentコンポーネント[/ja]
    * @seealso ons-splitter-side
    *  [en]ons-splitter-side component[/en]
    *  [ja]ons-splitter-sideコンポーネント[/ja]
    * @guide CallingComponentAPIsfromJavaScript
    *   [en]Using components from JavaScript[/en]
    *   [ja]JavaScriptからコンポーネントを呼び出す[/ja]
    * @example
    * <ons-splitter>
    *   <ons-splitter-content>
    *     ...
    *   </ons-splitter-content>
    *
    *   <ons-splitter-side side="left" width="80%" collapse>
    *     ...
    *   </ons-splitter-side>
    * </ons-splitter>
    */

   var SplitterElement = (function (_BaseElement) {
     babelHelpers.inherits(SplitterElement, _BaseElement);

     function SplitterElement() {
       babelHelpers.classCallCheck(this, SplitterElement);
       return babelHelpers.possibleConstructorReturn(this, Object.getPrototypeOf(SplitterElement).apply(this, arguments));
     }

     babelHelpers.createClass(SplitterElement, [{
       key: 'createdCallback',
       value: function createdCallback() {
         this._boundOnDeviceBackButton = this._onDeviceBackButton.bind(this);
         this._boundOnModeChange = this._onModeChange.bind(this);
       }
     }, {
       key: '_onModeChange',
       value: function _onModeChange(event) {
         if (event.target.parentElement === this) {
           this._layout();
         }
       }

       /**
        * @param {String} side 'left' or 'right'.
        * @return {Element}
        */

     }, {
       key: '_getSideElement',
       value: function _getSideElement(side) {
         var result = util.findChild(this, function (element) {
           return element.nodeName.toLowerCase() === 'ons-splitter-side' && element.getAttribute('side') === side;
         });

         if (result) {
           CustomElements.upgrade(result);
         }

         return result;
       }
     }, {
       key: '_layout',
       value: function _layout() {
         var content = this._getContentElement();
         var left = this._getSideElement('left');
         var right = this._getSideElement('right');

         if (content) {
           if (left && left.getCurrentMode && left.getCurrentMode() === 'split') {
             content.style.left = left._getWidth();
           } else {
             content.style.left = '0px';
           }

           if (right && right.getCurrentMode && right.getCurrentMode() === 'split') {
             content.style.right = right._getWidth();
           } else {
             content.style.right = '0px';
           }
         }
       }

       /**
        * @return {Element}
        */

     }, {
       key: '_getContentElement',
       value: function _getContentElement() {
         return util.findChild(this, 'ons-splitter-content');
       }
     }, {
       key: 'attributeChangedCallback',
       value: function attributeChangedCallback(name, last, current) {}

       /**
        * @method openRight
        * @signature openRight([options])
        * @param {Object} [options]
        *   [en]Parameter object.[/en]
        *   [ja]オプションを指定するオブジェクト。[/ja]
        * @param {Function} [options.callback]
        *   [en]This function will be called after the menu has been opened.[/en]
        *   [ja]メニューが開いた後に呼び出される関数オブジェクトを指定します。[/ja]
        * @description
        *   [en]Open right ons-splitter-side menu on collapse mode.[/en]
        *   [ja]右のcollapseモードになっているons-splitter-side要素を開きます。[/ja]
        * @return {Promise}
        *   [en]Resolves to the splitter side element[/en]
        *   [ja][/ja]
        */

     }, {
       key: 'openRight',
       value: function openRight() {
         var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

         return this._open('right', options);
       }
     }, {
       key: '_getMaskElement',
       value: function _getMaskElement() {
         var mask = util.findChild(this, 'ons-splitter-mask');
         return mask || this.appendChild(document.createElement('ons-splitter-mask'));
       }

       /**
        * @method openLeft
        * @signature openLeft([options])
        * @param {Object} [options]
        *   [en]Parameter object.[/en]
        *   [ja]オプションを指定するオブジェクト。[/ja]
        * @param {Function} [options.callback]
        *   [en]This function will be called after the menu has been opened.[/en]
        *   [ja]メニューが開いた後に呼び出される関数オブジェクトを指定します。[/ja]
        * @description
        *   [en]Open left ons-splitter-side menu on collapse mode.[/en]
        *   [ja]左のcollapseモードになっているons-splitter-side要素を開きます。[/ja]
        * @return {Promise}
        *   [en]Resolves to the splitter side element[/en]
        *   [ja][/ja]
        */

     }, {
       key: 'openLeft',
       value: function openLeft() {
         var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

         return this._open('left', options);
       }

       /**
        * @param {String} side
        * @param {Object} [options]
        * @return {Promise} Resolves to the splitter side element
        */

     }, {
       key: '_open',
       value: function _open(side) {
         var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

         var menu = this._getSideElement(side);

         return menu ? menu.open(options) : Promise.reject('child "ons-splitter-side" element is not found in this element.');
       }

       /**
        * @method closeRight
        * @signature closeRight([options])
        * @param {Object} [options]
        *   [en]Parameter object.[/en]
        *   [ja]オプションを指定するオブジェクト。[/ja]
        * @param {Function} [options.callback]
        *   [en]This function will be called after the menu has been closed.[/en]
        *   [ja]メニューが閉じた後に呼び出される関数オブジェクトを指定します。[/ja]
        * @description
        *   [en]Close right ons-splitter-side menu on collapse mode.[/en]
        *   [ja]右のcollapseモードになっているons-splitter-side要素を閉じます。[/ja]
        * @return {Promise}
        *   [en]Resolves to the splitter side element[/en]
        *   [ja][/ja]
        */

     }, {
       key: 'closeRight',
       value: function closeRight() {
         var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

         return this._close('right', options);
       }

       /**
        * @method closeLeft
        * @signature closeLeft([options])
        * @param {Object} [options]
        *   [en]Parameter object.[/en]
        *   [ja]オプションを指定するオブジェクト。[/ja]
        * @param {Function} [options.callback]
        *   [en]This function will be called after the menu has been closed.[/en]
        *   [ja]メニューが閉じた後に呼び出される関数オブジェクトを指定します。[/ja]
        * @description
        *   [en]Close left ons-splitter-side menu on collapse mode.[/en]
        *   [ja]左のcollapseモードになっているons-splitter-side要素を閉じます。[/ja]
        * @return {Promise}
        *   [en]Resolves to the splitter side element[/en]
        *   [ja][/ja]
        */

     }, {
       key: 'closeLeft',
       value: function closeLeft() {
         var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

         return this._close('left', options);
       }

       /**
        * @param {String} side
        * @param {Object} [options]
        * @return {Promise} Resolves to the splitter side element
        */

     }, {
       key: '_close',
       value: function _close(side) {
         var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

         var menu = this._getSideElement(side);

         return menu ? menu.close(options) : Promise.reject('child "ons-splitter-side" element is not found in this element.');
       }

       /**
        * @param {Object} [options]
        * @return {Promise} Resolves to the splitter side element
        */

     }, {
       key: 'toggleLeft',
       value: function toggleLeft() {
         var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

         return this._toggle('left', options);
       }

       /**
        * @param {Object} [options]
        * @return {Promise} Resolves to the splitter side element
        */

     }, {
       key: 'toggleRight',
       value: function toggleRight() {
         var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

         return this._toggle('right', options);
       }

       /**
        * @param {String} side
        * @param {Object} [options]
        * @return {Promise} Resolves to the splitter side element
        */

     }, {
       key: '_toggle',
       value: function _toggle(side) {
         var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

         var menu = this._getSideElement(side);

         return menu ? menu.toggle(options) : Promise.reject('child "ons-splitter-side" element is not found in this element.');
       }

       /**
        * @method leftIsOpen
        * @signature leftIsOpen()
        * @return {Boolean}
        *   [en]Whether the left ons-splitter-side on collapse mode is opened.[/en]
        *   [ja]左のons-splitter-sideが開いているかどうかを返します。[/ja]
        * @description
        *   [en]Determines whether the left ons-splitter-side on collapse mode is opened.[/en]
        *   [ja]左のons-splitter-side要素が開いているかどうかを返します。[/ja]
        */

     }, {
       key: 'leftIsOpen',
       value: function leftIsOpen() {
         return this._isOpen('left');
       }

       /**
        * @method rightIsOpen
        * @signature rightIsOpen()
        * @return {Boolean}
        *   [en]Whether the right ons-splitter-side on collapse mode is opened.[/en]
        *   [ja]右のons-splitter-sideが開いているかどうかを返します。[/ja]
        * @description
        *   [en]Determines whether the right ons-splitter-side on collapse mode is opened.[/en]
        *   [ja]右のons-splitter-side要素が開いているかどうかを返します。[/ja]
        */

     }, {
       key: 'rightIsOpen',
       value: function rightIsOpen() {
         return this._isOpen('right');
       }

       /**
        * @param {String} side
        * @return {Boolean}
        */

     }, {
       key: '_isOpen',
       value: function _isOpen(side) {
         var menu = this._getSideElement(side);

         if (menu) {
           return menu.isOpen();
         }

         return false;
       }

       /**
        * @method loadContentPage
        * @signature loadContentPage(pageUrl)
        * @param {String} pageUrl
        *   [en]Page URL. Can be either an HTML document or an <code>&lt;ons-template&gt;</code>.[/en]
        *   [ja]pageのURLか、ons-templateで宣言したテンプレートのid属性の値を指定します。[/ja]
        * @description
        *   [en]Show the page specified in pageUrl in the ons-splitter-content pane.[/en]
        *   [ja]ons-splitter-content要素に表示されるページをpageUrlに指定します。[/ja]
        */

     }, {
       key: 'loadContentPage',
       value: function loadContentPage(page) {
         var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

         var content = this._getContentElement();

         return content ? content.load(page, options) : Promise.reject('child "ons-splitter-content" element is not found in this element.');
       }
     }, {
       key: '_onDeviceBackButton',
       value: function _onDeviceBackButton(handler) {
         var left = this._getSideElement('left');
         var right = this._getSideElement('right');

         if (left.isOpen()) {
           left.close();
           return;
         }

         if (right.isOpen()) {
           right.close();
           return;
         }

         handler.callParentHandler();
       }
     }, {
       key: 'attachedCallback',
       value: function attachedCallback() {
         var _this2 = this;

         this._deviceBackButtonHandler = deviceBackButtonDispatcher.createHandler(this, this._boundOnDeviceBackButton);
         this._assertChildren();

         this.addEventListener('modechange', this._boundOnModeChange, false);

         setImmediate(function () {
           return _this2._layout();
         });
       }

       /**
        * @method getDeviceBackButtonHandler
        * @signature getDeviceBackButtonHandler()
        * @return {Object}
        *   [en]Device back-button handler.[/en]
        *   [ja]デバイスのバックボタンハンドラを返します。[/ja]
        * @description
        *   [en]Retrieve the back-button handler.[/en]
        *   [ja]ons-splitter要素に紐付いているバックボタンハンドラを取得します。[/ja]
        */

     }, {
       key: 'getDeviceBackButtonHandler',
       value: function getDeviceBackButtonHandler() {
         return this._deviceBackButtonHandler;
       }
     }, {
       key: '_assertChildren',
       value: function _assertChildren() {
         var names = ['ons-splitter-content', 'ons-splitter-side', 'ons-splitter-mask'];
         var contentCount = 0;
         var sideCount = 0;
         var maskCount = 0;

         util.arrayFrom(this.children).forEach(function (element) {
           var name = element.nodeName.toLowerCase();
           if (names.indexOf(name) === -1) {
             throw new Error('"' + name + '" element is not allowed in "ons-splitter" element.');
           }

           if (name === 'ons-splitter-content') {
             contentCount++;
           } else if (name === 'ons-splitter-content') {
             sideCount++;
           } else if (name === 'ons-splitter-mask') {
             maskCount++;
           }
         });

         if (contentCount > 1) {
           throw new Error('too many <ons-splitter-content> elements.');
         }

         if (sideCount > 2) {
           throw new Error('too many <ons-splitter-side> elements.');
         }

         if (maskCount > 1) {
           throw new Error('too many <ons-splitter-mask> elements.');
         }

         if (maskCount === 0) {
           this.appendChild(document.createElement('ons-splitter-mask'));
         }
       }
     }, {
       key: 'detachedCallback',
       value: function detachedCallback() {
         this._deviceBackButtonHandler.destroy();
         this._deviceBackButtonHandler = null;

         this.removeEventListener('modechange', this._boundOnModeChange, false);
       }
     }, {
       key: '_show',
       value: function _show() {
         util.arrayFrom(this.children).forEach(function (child) {
           if (child._show instanceof Function) {
             child._show();
           }
         });
       }
     }, {
       key: '_hide',
       value: function _hide() {
         util.arrayFrom(this.children).forEach(function (child) {
           if (child._hide instanceof Function) {
             child._hide();
           }
         });
       }
     }, {
       key: '_destroy',
       value: function _destroy() {
         util.arrayFrom(this.children).forEach(function (child) {
           if (child._destroy instanceof Function) {
             child._destroy();
           }
         });
         this.remove();
       }
     }]);
     return SplitterElement;
   })(BaseElement);

   window.OnsSplitterElement = document.registerElement('ons-splitter', {
     prototype: SplitterElement.prototype
   });

   window.OnsSplitterElement._animatorDict = {
     default: OverlaySplitterAnimator,
     overlay: OverlaySplitterAnimator
   };

   window.OnsSplitterElement.registerAnimator = function (name, Animator) {
     if (!(Animator instanceof SplitterAnimator)) {
       throw new Error('Animator parameter must be an instance of SplitterAnimator.');
     }
     window.OnsSplitterElement._animatorDict[name] = Animator;
   };

   window.OnsSplitterElement.SplitterAnimator = SplitterAnimator;

   var scheme$15 = {
     '': 'switch--*',
     '.switch__input': 'switch--*__input',
     '.switch__handle': 'switch--*__handle',
     '.switch__toggle': 'switch--*__toggle'
   };

   var template$2 = util.createFragment('\n  <input type="checkbox" class="switch__input">\n  <div class="switch__toggle">\n    <div class="switch__handle">\n      <div class="switch__touch"></div>\n    </div>\n  </div>\n');

   var locations = {
     ios: [1, 21],
     material: [0, 16]
   };

   /**
    * @element ons-switch
    * @category form
    * @description
    *  [en]Switch component. Can display either an iOS flat switch or a Material Design switch.[/en]
    *  [ja]スイッチを表示するコンポーネントです。[/ja]
    * @codepen LpXZQQ
    * @guide UsingFormComponents
    *   [en]Using form components[/en]
    *   [ja]フォームを使う[/ja]
    * @guide EventHandling
    *   [en]Event handling descriptions[/en]
    *   [ja]イベント処理の使い方[/ja]
    * @seealso ons-button
    *   [en]ons-button component[/en]
    *   [ja]ons-buttonコンポーネント[/ja]
    * @example
    * <ons-switch checked></ons-switch>
    * <ons-switch modifier="material"></ons-switch>
    */

   var SwitchElement = (function (_BaseElement) {
     babelHelpers.inherits(SwitchElement, _BaseElement);

     function SwitchElement() {
       babelHelpers.classCallCheck(this, SwitchElement);
       return babelHelpers.possibleConstructorReturn(this, Object.getPrototypeOf(SwitchElement).apply(this, arguments));
     }

     babelHelpers.createClass(SwitchElement, [{
       key: 'isChecked',

       /**
        * @method isChecked
        * @signature isChecked()
        * @return {Boolean}
        *   [en]true if the switch is on.[/en]
        *   [ja]ONになっている場合にはtrueになります。[/ja]
        * @description
        *   [en]Returns true if the switch is ON.[/en]
        *   [ja]スイッチがONの場合にtrueを返します。[/ja]
        */
       value: function isChecked() {
         return this.checked;
       }

       /**
        * @method setChecked
        * @signature setChecked(checked)
        * @param {Boolean} checked
        *   [en]If true the switch will be set to on.[/en]
        *   [ja]ONにしたい場合にはtrueを指定します。[/ja]
        * @description
        *   [en]Set the value of the switch. isChecked can be either true or false.[/en]
        *   [ja]スイッチの値を指定します。isCheckedにはtrueもしくはfalseを指定します。[/ja]
        */

     }, {
       key: 'setChecked',
       value: function setChecked(isChecked) {
         this.checked = !!isChecked;
       }

       /**
        * @method getCheckboxElement
        * @signature getCheckboxElement()
        * @return {HTMLElement}
        *   [en]The underlying checkbox element.[/en]
        *   [ja]コンポーネント内部のcheckbox要素になります。[/ja]
        * @description
        *   [en]Get inner input[type=checkbox] element.[/en]
        *   [ja]スイッチが内包する、input[type=checkbox]の要素を取得します。[/ja]
        */

     }, {
       key: 'getCheckboxElement',
       value: function getCheckboxElement() {
         return this._checkbox;
       }
     }, {
       key: 'createdCallback',
       value: function createdCallback() {
         var _this2 = this;

         if (!this.hasAttribute('_compiled')) {
           this._compile();
         }

         this._checkbox = this.querySelector('.switch__input');
         this._handle = this.querySelector('.switch__handle');

         ['checked', 'disabled', 'modifier', 'name', 'input-id'].forEach(function (e) {
           _this2.attributeChangedCallback(e, null, _this2.getAttribute(e));
         });
       }
     }, {
       key: '_compile',
       value: function _compile() {
         ons._autoStyle.prepare(this);

         this.classList.add('switch');

         this.appendChild(template$2.cloneNode(true));

         this.setAttribute('_compiled', '');
       }
     }, {
       key: 'detachedCallback',
       value: function detachedCallback() {
         this._checkbox.removeEventListener('change', this._onChange);
         this.removeEventListener('dragstart', this._onDragStart);
         this.removeEventListener('hold', this._onHold);
         this.removeEventListener('tap', this.click);
         this.removeEventListener('click', this._onClick);
         this._gestureDetector.dispose();
       }
     }, {
       key: 'attachedCallback',
       value: function attachedCallback() {
         this._checkbox.addEventListener('change', this._onChange);
         this._gestureDetector = new GestureDetector(this, { dragMinDistance: 1, holdTimeout: 251 });
         this.addEventListener('dragstart', this._onDragStart);
         this.addEventListener('hold', this._onHold);
         this.addEventListener('tap', this.click);
         this._boundOnRelease = this._onRelease.bind(this);
         this.addEventListener('click', this._onClick);
       }
     }, {
       key: '_onChange',
       value: function _onChange() {
         if (this.checked) {
           this.parentNode.setAttribute('checked', '');
         } else {
           this.parentNode.removeAttribute('checked');
         }
       }
     }, {
       key: '_onClick',
       value: function _onClick(ev) {
         if (ev.target.classList.contains('switch__touch')) {
           ev.preventDefault();
         }
       }
     }, {
       key: 'click',
       value: function click() {
         if (!this.disabled) {
           this.checked = !this.checked;
           util.triggerElementEvent(this.getCheckboxElement(), 'change');
         }
       }
     }, {
       key: '_getPosition',
       value: function _getPosition(e) {
         var l = this._locations;
         return Math.min(l[1], Math.max(l[0], this._startX + e.gesture.deltaX));
       }
     }, {
       key: '_onHold',
       value: function _onHold(e) {
         if (!this.disabled) {
           this.classList.add('switch--active');
           document.addEventListener('release', this._boundOnRelease);
         }
       }
     }, {
       key: '_onDragStart',
       value: function _onDragStart(e) {
         if (this.disabled || ['left', 'right'].indexOf(e.gesture.direction) === -1) {
           this.classList.remove('switch--active');
           return;
         }
         this.classList.add('switch--active');
         this._startX = this._locations[this.checked ? 1 : 0]; // - e.gesture.deltaX;

         this.addEventListener('drag', this._onDrag);
         document.addEventListener('release', this._boundOnRelease);
       }
     }, {
       key: '_onDrag',
       value: function _onDrag(e) {
         e.gesture.srcEvent.preventDefault();
         this._handle.style.left = this._getPosition(e) + 'px';
       }
     }, {
       key: '_onRelease',
       value: function _onRelease(e) {
         var l = this._locations;
         var position = this._getPosition(e);

         this.checked = position >= (l[0] + l[1]) / 2;

         this.removeEventListener('drag', this._onDrag);
         document.removeEventListener('release', this._boundOnRelease);

         this._handle.style.left = '';
         this.classList.remove('switch--active');
       }
     }, {
       key: 'attributeChangedCallback',
       value: function attributeChangedCallback(name, last, current) {
         switch (name) {
           case 'modifier':
             this._isMaterial = (current || '').indexOf('material') !== -1;
             this._locations = locations[this._isMaterial ? 'material' : 'ios'];
             ModifierUtil.onModifierChanged(last, current, this, scheme$15);
             break;
           case 'input-id':
             this._checkbox.id = current;
             break;
           case 'checked':
             // eslint-disable-line no-fallthrough
             this._checkbox.checked = current !== null;
           case 'disabled':
             if (current !== null) {
               this._checkbox.setAttribute(name, '');
             } else {
               this._checkbox.removeAttribute(name);
             }
         }
       }
     }, {
       key: 'checked',

       /**
        * @event change
        * @description
        *   [en]Fired when the value is changed.[/en]
        *   [ja]ON/OFFが変わった時に発火します。[/ja]
        * @param {Object} event
        *   [en]Event object.[/en]
        *   [ja]イベントオブジェクト。[/ja]
        * @param {Object} event.switch
        *   [en]Switch object.[/en]
        *   [ja]イベントが発火したSwitchオブジェクトを返します。[/ja]
        * @param {Boolean} event.value
        *   [en]Current value.[/en]
        *   [ja]現在の値を返します。[/ja]
        * @param {Boolean} event.isInteractive
        *   [en]True if the change was triggered by the user clicking on the switch.[/en]
        *   [ja]タップやクリックなどのユーザの操作によって変わった場合にはtrueを返します。[/ja]
        */

       /**
        * @attribute modifier
        * @type {String}
        * @description
        *  [en]The appearance of the switch.[/en]
        *  [ja]スイッチの表現を指定します。[/ja]
        */

       /**
        * @attribute disabled
        * @description
        *   [en]Whether the switch should be disabled.[/en]
        *   [ja]スイッチを無効の状態にする場合に指定します。[/ja]
        */

       /**
        * @attribute checked
        * @description
        *   [en]Whether the switch is checked.[/en]
        *   [ja]スイッチがONの状態にするときに指定します。[/ja]
        */

       get: function get() {
         return this._checkbox.checked;
       },
       set: function set(value) {
         if (!!value !== this._checkbox.checked) {
           this._checkbox.click();
           this._checkbox.checked = !!value;
           if (this.checked) {
             this.setAttribute('checked', '');
           } else {
             this.removeAttribute('checked');
           }
         }
       }
     }, {
       key: 'disabled',
       get: function get() {
         return this._checkbox.disabled;
       },
       set: function set(value) {
         this._checkbox.disabled = value;
         if (this.disabled) {
           this.setAttribute('disabled', '');
         } else {
           this.removeAttribute('disabled');
         }
       }
     }]);
     return SwitchElement;
   })(BaseElement);

   window.OnsSwitchElement = document.registerElement('ons-switch', {
     prototype: SwitchElement.prototype
   });

   /*
   Copyright 2013-2015 ASIAL CORPORATION

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.

   */

   var TabbarAnimator = (function () {

     /**
      * @param {Object} options
      * @param {String} options.timing
      * @param {Number} options.duration
      * @param {Number} options.delay
      */

     function TabbarAnimator() {
       var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];
       babelHelpers.classCallCheck(this, TabbarAnimator);

       this.timing = options.timing || 'linear';
       this.duration = options.duration !== undefined ? options.duration : '0.4';
       this.delay = options.delay !== undefined ? options.delay : '0';
     }

     /**
      * @param {Element} enterPage ons-page element
      * @param {Element} leavePage ons-page element
      * @param {Number} enterPageIndex
      * @param {Number} leavePageIndex
      * @param {Function} done
      */

     babelHelpers.createClass(TabbarAnimator, [{
       key: 'apply',
       value: function apply(enterPage, leavePage, enterPageIndex, leavePageIndex, done) {
         throw new Error('This method must be implemented.');
       }
     }]);
     return TabbarAnimator;
   })();

   var TabbarNoneAnimator = (function (_TabbarAnimator) {
     babelHelpers.inherits(TabbarNoneAnimator, _TabbarAnimator);

     function TabbarNoneAnimator() {
       babelHelpers.classCallCheck(this, TabbarNoneAnimator);
       return babelHelpers.possibleConstructorReturn(this, Object.getPrototypeOf(TabbarNoneAnimator).apply(this, arguments));
     }

     babelHelpers.createClass(TabbarNoneAnimator, [{
       key: 'apply',
       value: function apply(enterPage, leavePage, enterIndex, leaveIndex, done) {
         setTimeout(done, 1000 / 60);
       }
     }]);
     return TabbarNoneAnimator;
   })(TabbarAnimator);

   var TabbarFadeAnimator = (function (_TabbarAnimator2) {
     babelHelpers.inherits(TabbarFadeAnimator, _TabbarAnimator2);

     function TabbarFadeAnimator(options) {
       babelHelpers.classCallCheck(this, TabbarFadeAnimator);

       options.timing = options.timing !== undefined ? options.timing : 'linear';
       options.duration = options.duration !== undefined ? options.duration : '0.4';
       options.delay = options.delay !== undefined ? options.delay : '0';

       return babelHelpers.possibleConstructorReturn(this, Object.getPrototypeOf(TabbarFadeAnimator).call(this, options));
     }

     babelHelpers.createClass(TabbarFadeAnimator, [{
       key: 'apply',
       value: function apply(enterPage, leavePage, enterPageIndex, leavePageIndex, done) {
         animit.runAll(animit(enterPage).saveStyle().queue({
           transform: 'translate3D(0, 0, 0)',
           opacity: 0
         }).wait(this.delay).queue({
           transform: 'translate3D(0, 0, 0)',
           opacity: 1
         }, {
           duration: this.duration,
           timing: this.timing
         }).restoreStyle().queue(function (callback) {
           done();
           callback();
         }), animit(leavePage).queue({
           transform: 'translate3D(0, 0, 0)',
           opacity: 1
         }).wait(this.delay).queue({
           transform: 'translate3D(0, 0, 0)',
           opacity: 0
         }, {
           duration: this.duration,
           timing: this.timing
         }));
       }
     }]);
     return TabbarFadeAnimator;
   })(TabbarAnimator);

   var TabbarSlideAnimator = (function (_TabbarAnimator3) {
     babelHelpers.inherits(TabbarSlideAnimator, _TabbarAnimator3);

     function TabbarSlideAnimator(options) {
       babelHelpers.classCallCheck(this, TabbarSlideAnimator);

       options.timing = options.timing !== undefined ? options.timing : 'ease-in';
       options.duration = options.duration !== undefined ? options.duration : '0.15';
       options.delay = options.delay !== undefined ? options.delay : '0';

       return babelHelpers.possibleConstructorReturn(this, Object.getPrototypeOf(TabbarSlideAnimator).call(this, options));
     }

     /**
      * @param {jqLite} enterPage
      * @param {jqLite} leavePage
      */

     babelHelpers.createClass(TabbarSlideAnimator, [{
       key: 'apply',
       value: function apply(enterPage, leavePage, enterIndex, leaveIndex, done) {
         var sgn = enterIndex > leaveIndex;

         animit.runAll(animit(enterPage).saveStyle().queue({
           transform: 'translate3D(' + (sgn ? '' : '-') + '100%, 0, 0)'
         }).wait(this.delay).queue({
           transform: 'translate3D(0, 0, 0)'
         }, {
           duration: this.duration,
           timing: this.timing
         }).restoreStyle().queue(function (callback) {
           done();
           callback();
         }), animit(leavePage).queue({
           transform: 'translate3D(0, 0, 0)'
         }).wait(this.delay).queue({
           transform: 'translate3D(' + (sgn ? '-' : '') + '100%, 0, 0)'
         }, {
           duration: this.duration,
           timing: this.timing
         }));
       }
     }]);
     return TabbarSlideAnimator;
   })(TabbarAnimator);

   var scheme$24 = {
     '.tab-bar__content': 'tab-bar--*__content',
     '.tab-bar': 'tab-bar--*'
   };

   var _animatorDict$5 = {
     'default': TabbarNoneAnimator,
     'fade': TabbarFadeAnimator,
     'slide': TabbarSlideAnimator,
     'none': TabbarNoneAnimator
   };

   var rewritables$3 = {
     /**
      * @param {Element} tabbarElement
      * @param {Function} callback
      */

     ready: function ready(tabbarElement, callback) {
       callback();
     },

     /**
      * @param {Element} tabbarElement
      * @param {Element} target
      * @param {Object} options
      * @param {Function} callback
      */
     link: function link(tabbarElement, target, options, callback) {
       callback(target);
     },

     /**
      * @param {Element} tabbarElement
      * @param {Element} target
      * @param {Function} callback
      */
     unlink: function unlink(tabbarElement, target, callback) {
       callback(target);
     }
   };

   var generateId$1 = (function () {
     var i = 0;
     return function () {
       return 'ons-tabbar-gen-' + i++;
     };
   })();

   /**
    * @element ons-tabbar
    * @category navigation
    * @description
    *   [en]A component to display a tab bar on the bottom of a page. Used with ons-tab to manage pages using tabs.[/en]
    *   [ja]タブバーをページ下部に表示するためのコンポーネントです。ons-tabと組み合わせて使うことで、ページを管理できます。[/ja]
    * @codepen pGuDL
    * @guide UsingTabBar
    *   [en]Using tab bar[/en]
    *   [ja]タブバーを使う[/ja]
    * @guide EventHandling
    *   [en]Event handling descriptions[/en]
    *   [ja]イベント処理の使い方[/ja]
    * @guide CallingComponentAPIsfromJavaScript
    *   [en]Using navigator from JavaScript[/en]
    *   [ja]JavaScriptからコンポーネントを呼び出す[/ja]
    * @guide DefiningMultiplePagesinSingleHTML
    *   [en]Defining multiple pages in single html[/en]
    *   [ja]複数のページを1つのHTMLに記述する[/ja]
    * @seealso ons-tab
    *   [en]ons-tab component[/en]
    *   [ja]ons-tabコンポーネント[/ja]
    * @seealso ons-page
    *   [en]ons-page component[/en]
    *   [ja]ons-pageコンポーネント[/ja]
    * @example
    * <ons-tabbar>
    *   <ons-tab page="home.html" active="true">
    *     <ons-icon icon="ion-home"></ons-icon>
    *     <span style="font-size: 14px">Home</span>
    *   </ons-tab>
    *   <ons-tab page="fav.html" active="true">
    *     <ons-icon icon="ion-star"></ons-icon>
    *     <span style="font-size: 14px">Favorites</span>
    *   </ons-tab>
    *   <ons-tab page="settings.html" active="true">
    *     <ons-icon icon="ion-gear-a"></ons-icon>
    *     <span style="font-size: 14px">Settings</span>
    *   </ons-tab>
    * </ons-tabbar>
    *
    * <ons-template id="home.html">
    *   ...
    * </ons-template>
    *
    * <ons-template id="fav.html">
    *   ...
    * </ons-template>
    *
    * <ons-template id="settings.html">
    *   ...
    * </ons-template>
    */

   var TabbarElement = (function (_BaseElement) {
     babelHelpers.inherits(TabbarElement, _BaseElement);

     function TabbarElement() {
       babelHelpers.classCallCheck(this, TabbarElement);
       return babelHelpers.possibleConstructorReturn(this, Object.getPrototypeOf(TabbarElement).apply(this, arguments));
     }

     babelHelpers.createClass(TabbarElement, [{
       key: 'createdCallback',

       /**
        * @event prechange
        * @description
        *   [en]Fires just before the tab is changed.[/en]
        *   [ja]アクティブなタブが変わる前に発火します。[/ja]
        * @param {Object} event
        *   [en]Event object.[/en]
        *   [ja]イベントオブジェクト。[/ja]
        * @param {Number} event.index
        *   [en]Current index.[/en]
        *   [ja]現在アクティブになっているons-tabのインデックスを返します。[/ja]
        * @param {Object} event.tabItem
        *   [en]Tab item object.[/en]
        *   [ja]tabItemオブジェクト。[/ja]
        * @param {Function} event.cancel
        *   [en]Call this function to cancel the change event.[/en]
        *   [ja]この関数を呼び出すと、アクティブなタブの変更がキャンセルされます。[/ja]
        */

       /**
        * @event postchange
        * @description
        *   [en]Fires just after the tab is changed.[/en]
        *   [ja]アクティブなタブが変わった後に発火します。[/ja]
        * @param {Object} event
        *   [en]Event object.[/en]
        *   [ja]イベントオブジェクト。[/ja]
        * @param {Number} event.index
        *   [en]Current index.[/en]
        *   [ja]現在アクティブになっているons-tabのインデックスを返します。[/ja]
        * @param {Object} event.tabItem
        *   [en]Tab item object.[/en]
        *   [ja]tabItemオブジェクト。[/ja]
        */

       /**
        * @event reactive
        * @description
        *   [en]Fires if the already open tab is tapped again.[/en]
        *   [ja]すでにアクティブになっているタブがもう一度タップやクリックされた場合に発火します。[/ja]
        * @param {Object} event
        *   [en]Event object.[/en]
        *   [ja]イベントオブジェクト。[/ja]
        * @param {Number} event.index
        *   [en]Current index.[/en]
        *   [ja]現在アクティブになっているons-tabのインデックスを返します。[/ja]
        * @param {Object} event.tabItem
        *   [en]Tab item object.[/en]
        *   [ja]tabItemオブジェクト。[/ja]
        */

       /**
        * @attribute animation
        * @type {String}
        * @default none
        * @description
        *   [en]Animation name. Preset values are "none", "slide" and "fade". Default is "none".[/en]
        *   [ja]ページ読み込み時のアニメーションを指定します。"none"、"fade"、"slide"のいずれかを選択できます。デフォルトは"none"です。[/ja]
        */

       /**
        * @attribute animation-options
        * @type {Expression}
        * @description
        *  [en]Specify the animation's duration, timing and delay with an object literal. E.g. <code>{duration: 0.2, delay: 1, timing: 'ease-in'}</code>[/en]
        *  [ja]アニメーション時のduration, timing, delayをオブジェクトリテラルで指定します。e.g. <code>{duration: 0.2, delay: 1, timing: 'ease-in'}</code>[/ja]
        */

       /**
        * @attribute position
        * @initonly
        * @type {String}
        * @default bottom
        * @description
        *   [en]Tabbar's position. Preset values are "bottom" and "top". Default is "bottom".[/en]
        *   [ja]タブバーの位置を指定します。"bottom"もしくは"top"を選択できます。デフォルトは"bottom"です。[/ja]
        */

       value: function createdCallback() {
         this._tabbarId = generateId$1();

         if (!this.hasAttribute('_compiled')) {
           this._compile();
         }

         this._contentElement = util.findChild(this, '.tab-bar__content');

         this._animatorFactory = new AnimatorFactory({
           animators: _animatorDict$5,
           baseClass: TabbarAnimator,
           baseClassName: 'TabbarAnimator',
           defaultAnimation: this.getAttribute('animation')
         });
       }
     }, {
       key: '_compile',
       value: function _compile() {
         ons._autoStyle.prepare(this);

         if (this.getAttribute('position') === 'auto') {
           this.setAttribute('position', ons.platform.isAndroid() ? 'top' : 'bottom');
         }

         var wrapper = document.createDocumentFragment();

         var content = document.createElement('div');
         content.classList.add('ons-tab-bar__content');
         content.classList.add('tab-bar__content');

         var tabbar = document.createElement('div');
         tabbar.classList.add('tab-bar');
         tabbar.classList.add('ons-tab-bar__footer');
         tabbar.classList.add('ons-tabbar-inner');

         wrapper.appendChild(content);
         wrapper.appendChild(tabbar);

         while (this.childNodes[0]) {
           tabbar.appendChild(this.removeChild(this.childNodes[0]));
         }

         this.appendChild(wrapper);

         if (this._hasTopTabbar()) {
           this._prepareForTopTabbar();
         }

         ModifierUtil.initModifier(this, scheme$24);

         this.setAttribute('_compiled', '');
       }
     }, {
       key: '_hasTopTabbar',
       value: function _hasTopTabbar() {
         return this.getAttribute('position') === 'top';
       }
     }, {
       key: '_prepareForTopTabbar',
       value: function _prepareForTopTabbar() {
         var _this2 = this;

         var content = util.findChild(this, '.tab-bar__content');
         var tabbar = util.findChild(this, '.tab-bar');

         content.setAttribute('no-status-bar-fill', '');

         content.classList.add('tab-bar--top__content');
         tabbar.classList.add('tab-bar--top');

         var page = util.findParent(this, 'ons-page');
         if (page) {
           this.style.top = window.getComputedStyle(page._getContentElement(), null).getPropertyValue('padding-top');

           if (page.firstChild.tagName.toLowerCase() === 'ons-toolbar') {
             util.addModifier(page.firstChild, 'noshadow');
           }
         }

         internal.shouldFillStatusBar(this).then(function () {
           var fill = _this2.querySelector('.tab-bar__status-bar-fill');

           if (fill instanceof HTMLElement) {
             return fill;
           }

           fill = document.createElement('div');
           fill.classList.add('tab-bar__status-bar-fill');
           fill.style.width = '0px';
           fill.style.height = '0px';

           _this2.insertBefore(fill, _this2.children[0]);

           return fill;
         }).catch(function () {
           var el = _this2.querySelector('.tab-bar__status-bar-fill');
           if (el instanceof HTMLElement) {
             el.remove();
           }
         });
       }
     }, {
       key: '_getTabbarElement',
       value: function _getTabbarElement() {
         return util.findChild(this, '.tab-bar');
       }

       /**
        * @method loadPage
        * @signature loadPage(url, [options])
        * @param {String} url
        *   [en]Page URL. Can be either an HTML document or an <code>&lt;ons-template&gt;</code>.[/en]
        *   [ja]pageのURLか、もしくは<code>&lt;ons-template&gt;</code>で宣言したid属性の値を利用できます。[/ja]
        * @description
        *   [en]Displays a new page without changing the active index.[/en]
        *   [ja]現在のアクティブなインデックスを変更せずに、新しいページを表示します。[/ja]
        * @param {Object} [options]
        *   [en][/en]
        *   [ja][/ja]
        * @param {Object} [options.animation]
        *   [en][/en]
        *   [ja][/ja]
        * @param {Object} [options.callback]
        *   [en][/en]
        *   [ja][/ja]
        * @return {Promise}
        *   [en]Resolves to the new page element.[/en]
        *   [ja][/ja]
        */

     }, {
       key: 'loadPage',
       value: function loadPage(page) {
         var _this3 = this;

         var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

         return new Promise(function (resolve) {
           OnsTabElement.prototype._createPageElement(page, function (pageElement) {
             resolve(_this3._loadPageDOMAsync(pageElement, options));
           });
         });
       }

       /**
        * @param {Element} pageElement
        * @param {Object} [options]
        * @param {Object} [options.animation]
        * @param {Object} [options.callback]
        * @return {Promise} Resolves to the new page element.
        */

     }, {
       key: '_loadPageDOMAsync',
       value: function _loadPageDOMAsync(pageElement) {
         var _this4 = this;

         var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

         return new Promise(function (resolve) {
           rewritables$3.link(_this4, pageElement, options, function (pageElement) {
             _this4._contentElement.appendChild(pageElement);

             if (_this4.getActiveTabIndex() !== -1) {
               resolve(_this4._switchPage(pageElement, options));
             } else {
               if (options.callback instanceof Function) {
                 options.callback();
               }

               _this4._oldPageElement = pageElement;
               resolve(pageElement);
             }
           });
         });
       }

       /**
        * @return {String}
        */

     }, {
       key: 'getTabbarId',
       value: function getTabbarId() {
         return this._tabbarId;
       }

       /**
        * @return {Element/null}
        */

     }, {
       key: '_getCurrentPageElement',
       value: function _getCurrentPageElement() {
         var pages = this._contentElement.children;
         var page = null;
         for (var i = 0; i < pages.length; i++) {
           if (pages[i].style.display !== 'none') {
             page = pages[i];
             break;
           }
         }

         if (page && page.nodeName.toLowerCase() !== 'ons-page') {
           throw new Error('Invalid state: page element must be a "ons-page" element.');
         }

         return page;
       }

       /**
        * @param {Element} element
        * @param {Object} options
        * @param {String} [options.animation]
        * @param {Function} [options.callback]
        * @param {Object} [options.animationOptions]
        * @param {Boolean} options._removeElement
        * @param {Number} options.selectedTabIndex
        * @param {Number} options.previousTabIndex
        * @return {Promise} Resolves to the new page element.
        */

     }, {
       key: '_switchPage',
       value: function _switchPage(element, options) {
         var _this5 = this;

         var oldPageElement = this._oldPageElement || internal.nullElement;
         this._oldPageElement = element;
         var animator = this._animatorFactory.newAnimator(options);

         return new Promise(function (resolve) {
           if (oldPageElement !== internal.nullElement) {
             oldPageElement._hide();
           }

           animator.apply(element, oldPageElement, options.selectedTabIndex, options.previousTabIndex, function () {
             if (oldPageElement !== internal.nullElement) {
               if (options._removeElement) {
                 rewritables$3.unlink(_this5, oldPageElement, function (pageElement) {
                   pageElement._destroy();
                 });
               } else {
                 oldPageElement.style.display = 'none';
               }
             }

             element.style.display = 'block';
             element._show();

             if (options.callback instanceof Function) {
               options.callback();
             }

             resolve(element);
           });
         });
       }

       /**
        * @method setActiveTab
        * @signature setActiveTab(index, [options])
        * @param {Number} index
        *   [en]Tab index.[/en]
        *   [ja]タブのインデックスを指定します。[/ja]
        * @param {Object} [options]
        *   [en]Parameter object.[/en]
        *   [ja]オプションを指定するオブジェクト。[/ja]
        * @param {Boolean} [options.keepPage]
        *   [en]If true the page will not be changed.[/en]
        *   [ja]タブバーが現在表示しているpageを変えない場合にはtrueを指定します。[/ja]
        * @param {String} [options.animation]
        *   [en]Animation name. Available animations are "fade", "slide" and "none".[/en]
        *   [ja]アニメーション名を指定します。"fade"、"slide"、"none"のいずれかを指定できます。[/ja]
        * @param {String} [options.animationOptions]
        *   [en]Specify the animation's duration, delay and timing. E.g.  <code>{duration: 0.2, delay: 0.4, timing: 'ease-in'}</code>[/en]
        *   [ja]アニメーション時のduration, delay, timingを指定します。e.g. <code>{duration: 0.2, delay: 0.4, timing: 'ease-in'}</code> [/ja]
        * @description
        *   [en]Show specified tab page. Animations and other options can be specified by the second parameter.[/en]
        *   [ja]指定したインデックスのタブを表示します。アニメーションなどのオプションを指定できます。[/ja]
        * @return {Promise}
        *   [en]Resolves to the new page element.[/en]
        *   [ja][/ja]
        */

     }, {
       key: 'setActiveTab',
       value: function setActiveTab(index) {
         var _this6 = this;

         var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

         if (options && (typeof options === 'undefined' ? 'undefined' : babelHelpers.typeof(options)) != 'object') {
           throw new Error('options must be an object. You supplied ' + options);
         }

         options.animationOptions = util.extend(options.animationOptions || {}, AnimatorFactory.parseAnimationOptionsString(this.getAttribute('animation-options')));

         if (!options.animation && this.hasAttribute('animation')) {
           options.animation = this.getAttribute('animation');
         }

         var previousTab = this._getActiveTabElement(),
             selectedTab = this._getTabElement(index),
             previousTabIndex = this.getActiveTabIndex(),
             selectedTabIndex = index,
             previousPageElement = this._getCurrentPageElement();

         if (!selectedTab) {
           return Promise.reject('Specified index does not match any tab.');
         }

         if (selectedTabIndex === previousTabIndex) {
           util.triggerElementEvent(this, 'reactive', {
             index: selectedTabIndex,
             tabItem: selectedTab
           });

           return Promise.resolve(previousPageElement);
         }

         var canceled = false;

         util.triggerElementEvent(this, 'prechange', {
           index: selectedTabIndex,
           tabItem: selectedTab,
           cancel: function cancel() {
             return canceled = true;
           }
         });

         if (canceled) {
           selectedTab.setInactive();
           if (previousTab) {
             previousTab.setActive();
           }
           return Promise.reject('Canceled in prechange event.');
         }

         selectedTab.setActive();

         var needLoad = !selectedTab.isLoaded() && !options.keepPage;

         util.arrayFrom(this._getTabbarElement().children).forEach(function (tab) {
           if (tab != selectedTab) {
             tab.setInactive();
           } else {
             if (!needLoad) {
               util.triggerElementEvent(_this6, 'postchange', {
                 index: selectedTabIndex,
                 tabItem: selectedTab
               });
             }
           }
         });

         if (needLoad) {
           var removeElement;
           var params;

           var _ret = (function () {
             removeElement = false;

             if (!previousTab && previousPageElement || previousTab && previousTab._pageElement !== previousPageElement) {
               removeElement = true;
             }

             params = {
               callback: function callback() {
                 util.triggerElementEvent(_this6, 'postchange', {
                   index: selectedTabIndex,
                   tabItem: selectedTab
                 });

                 if (options.callback instanceof Function) {
                   options.callback();
                 }
               },
               previousTabIndex: previousTabIndex,
               selectedTabIndex: selectedTabIndex,
               _removeElement: removeElement
             };

             if (options.animation) {
               params.animation = options.animation;
             }

             params.animationOptions = options.animationOptions || {};

             var link = function link(element, callback) {
               rewritables$3.link(_this6, element, options, callback);
             };

             return {
               v: new Promise(function (resolve) {
                 selectedTab._loadPageElement(function (pageElement) {
                   resolve(_this6._loadPersistentPageDOM(pageElement, params));
                 }, link);
               })
             };
           })();

           if ((typeof _ret === 'undefined' ? 'undefined' : babelHelpers.typeof(_ret)) === "object") return _ret.v;
         }

         return Promise.resolve(previousPageElement);
       }

       /**
        * @param {Element} element
        * @param {Object} options
        * @param {Object} options.animation
        */

     }, {
       key: '_loadPersistentPageDOM',
       value: function _loadPersistentPageDOM(element) {
         var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

         if (!util.isAttached(element)) {
           this._contentElement.appendChild(element);
         }

         element.removeAttribute('style');
         return this._switchPage(element, options);
       }

       /**
        * @method setTabbarVisibility
        * @signature setTabbarVisibility(visible)
        * @param {Boolean} visible
        * @description
        *   [en][/en]
        *   [ja][/ja]
        */

     }, {
       key: 'setTabbarVisibility',
       value: function setTabbarVisibility(visible) {
         this._contentElement.style[this._hasTopTabbar() ? 'top' : 'bottom'] = visible ? '' : '0px';
         this._getTabbarElement().style.display = visible ? '' : 'none';
       }

       /**
        * @method getActiveTabIndex
        * @signature getActiveTabIndex()
        * @return {Number}
        *   [en]The index of the currently active tab.[/en]
        *   [ja]現在アクティブになっているタブのインデックスを返します。[/ja]
        * @description
        *   [en]Returns tab index on current active tab. If active tab is not found, returns -1.[/en]
        *   [ja]現在アクティブになっているタブのインデックスを返します。現在アクティブなタブがない場合には-1を返します。[/ja]
        */

     }, {
       key: 'getActiveTabIndex',
       value: function getActiveTabIndex() {
         var tabs = this._getTabbarElement().children;

         for (var i = 0; i < tabs.length; i++) {
           if (tabs[i] instanceof window.OnsTabElement && tabs[i].isActive && tabs[i].isActive()) {
             return i;
           }
         }

         return -1;
       }

       /**
        * @return {Number} When active tab is not found, returns -1.
        */

     }, {
       key: '_getActiveTabElement',
       value: function _getActiveTabElement() {
         return this._getTabElement(this.getActiveTabIndex());
       }

       /**
        * @return {Element}
        */

     }, {
       key: '_getTabElement',
       value: function _getTabElement(index) {
         return this._getTabbarElement().children[index];
       }
     }, {
       key: 'detachedCallback',
       value: function detachedCallback() {}
     }, {
       key: 'attachedCallback',
       value: function attachedCallback() {}
     }, {
       key: '_show',
       value: function _show() {
         var currentPageElement = this._getCurrentPageElement();
         if (currentPageElement) {
           currentPageElement._show();
         }
       }
     }, {
       key: '_hide',
       value: function _hide() {
         var currentPageElement = this._getCurrentPageElement();
         if (currentPageElement) {
           currentPageElement._hide();
         }
       }
     }, {
       key: '_destroy',
       value: function _destroy() {
         var pages = this._contentElement.children;
         for (var i = pages.length - 1; i >= 0; i--) {
           pages[i]._destroy();
         }
         this.remove();
       }
     }, {
       key: 'attributeChangedCallback',
       value: function attributeChangedCallback(name, last, current) {
         if (name === 'modifier') {
           return ModifierUtil.onModifierChanged(last, current, this, scheme$24);
         }
       }
     }]);
     return TabbarElement;
   })(BaseElement);

   window.OnsTabbarElement = document.registerElement('ons-tabbar', {
     prototype: TabbarElement.prototype
   });

   /**
    * @param {String} name
    * @param {Function} Animator
    */
   window.OnsTabbarElement.registerAnimator = function (name, Animator) {
     if (!(Animator.prototype instanceof TabbarAnimator)) {
       throw new Error('"Animator" param must inherit OnsTabbarElement.TabbarAnimator');
     }
     _animatorDict$5[name] = Animator;
   };

   window.OnsTabbarElement.rewritables = rewritables$3;
   window.OnsTabbarElement.TabbarAnimator = TabbarAnimator;

   var OnsTabbarElement$1 = OnsTabbarElement;

   var scheme$16 = {
     '': 'tab-bar--*__item',
     '.tab-bar__button': 'tab-bar--*__button'
   };
   var templateSource = util.createElement('\n  <div>\n    <input type="radio" style="display: none">\n    <button class="tab-bar__button tab-bar-inner"></button>\n  </div>\n');
   var defaultInnerTemplateSource = util.createElement('\n  <div>\n    <div class="tab-bar__icon">\n      <ons-icon icon="ion-cloud" style="font-size: 28px; line-height: 34px; vertical-align: top;"></ons-icon>\n    </div>\n    <div class="tab-bar__label">label</div>\n  </div>\n');

   /**
    * @element ons-tab
    * @category navigation
    * @description
    *   [en]Represents a tab inside tabbar. Each ons-tab represents a page.[/en]
    *   [ja]
    *     タブバーに配置される各アイテムのコンポーネントです。それぞれのons-tabはページを表します。
    *     ons-tab要素の中には、タブに表示されるコンテンツを直接記述することが出来ます。
    *   [/ja]
    * @codepen pGuDL
    * @guide UsingTabBar
    *   [en]Using tab bar[/en]
    *   [ja]タブバーを使う[/ja]
    * @guide DefiningMultiplePagesinSingleHTML
    *   [en]Defining multiple pages in single html[/en]
    *   [ja]複数のページを1つのHTMLに記述する[/ja]
    * @seealso ons-tabbar
    *   [en]ons-tabbar component[/en]
    *   [ja]ons-tabbarコンポーネント[/ja]
    * @seealso ons-page
    *   [en]ons-page component[/en]
    *   [ja]ons-pageコンポーネント[/ja]
    * @seealso ons-icon
    *   [en]ons-icon component[/en]
    *   [ja]ons-iconコンポーネント[/ja]
    * @example
    * <ons-tabbar>
    *   <ons-tab page="home.html" active="true">
    *     <ons-icon icon="ion-home"></ons-icon>
    *     <span style="font-size: 14px">Home</span>
    *   </ons-tab>
    *   <ons-tab page="fav.html" active="true">
    *     <ons-icon icon="ion-star"></ons-icon>
    *     <span style="font-size: 14px">Favorites</span>
    *   </ons-tab>
    *   <ons-tab page="settings.html" active="true">
    *     <ons-icon icon="ion-gear-a"></ons-icon>
    *     <span style="font-size: 14px">Settings</span>
    *   </ons-tab>
    * </ons-tabbar>
    *
    * <ons-template id="home.html">
    *   ...
    * </ons-template>
    *
    * <ons-template id="fav.html">
    *   ...
    * </ons-template>
    *
    * <ons-template id="settings.html">
    *   ...
    * </ons-template>
    */

   var TabElement = (function (_BaseElement) {
     babelHelpers.inherits(TabElement, _BaseElement);

     function TabElement() {
       babelHelpers.classCallCheck(this, TabElement);
       return babelHelpers.possibleConstructorReturn(this, Object.getPrototypeOf(TabElement).apply(this, arguments));
     }

     babelHelpers.createClass(TabElement, [{
       key: 'createdCallback',

       /**
        * @attribute page
        * @initonly
        * @type {String}
        * @description
        *   [en]The page that this <code>&lt;ons-tab&gt;</code> points to.[/en]
        *   [ja]<code>&lt;ons-tab&gt;</code>が参照するページへのURLを指定します。[/ja]
        */

       /**
        * @attribute icon
        * @type {String}
        * @description
        *   [en]
        *     The icon name for the tab. Can specify the same icon name as <code>&lt;ons-icon&gt;</code>.
        *     If you need to use your own icon, create a css class with background-image or any css properties and specify the name of your css class here.
        *   [/en]
        *   [ja]
        *     アイコン名を指定します。<code>&lt;ons-icon&gt;</code>と同じアイコン名を指定できます。
        *     個別にアイコンをカスタマイズする場合は、background-imageなどのCSSスタイルを用いて指定できます。
        *   [/ja]
        */

       /**
        * @attribute active-icon
        * @type {String}
        * @description
        *   [en]The name of the icon when the tab is active.[/en]
        *   [ja]アクティブの際のアイコン名を指定します。[/ja]
        */

       /**
        * @attribute label
        * @type {String}
        * @description
        *   [en]The label of the tab item.[/en]
        *   [ja]アイコン下に表示されるラベルを指定します。[/ja]
        */

       /**
        * @attribute active
        * @type {Boolean}
        * @default false
        * @description
        *   [en]Set whether this item should be active or not. Valid values are true and false.[/en]
        *   [ja]このタブアイテムをアクティブ状態にするかどうかを指定します。trueもしくはfalseを指定できます。[/ja]
        */

       value: function createdCallback() {
         if (!this.hasAttribute('_compiled')) {
           this._compile();
         }

         this._boundOnClick = this._onClick.bind(this);
       }
     }, {
       key: '_compile',
       value: function _compile() {
         ons._autoStyle.prepare(this);

         var fragment = document.createDocumentFragment();
         var hasChildren = false;

         while (this.childNodes[0]) {
           var node = this.childNodes[0];
           this.removeChild(node);
           fragment.appendChild(node);

           if (node.nodeType == Node.ELEMENT_NODE) {
             hasChildren = true;
           }
         }

         var template = templateSource.cloneNode(true);
         while (template.children[0]) {
           this.appendChild(template.children[0]);
         }
         this.classList.add('tab-bar__item');

         var button = util.findChild(this, '.tab-bar__button');

         if (hasChildren) {
           button.appendChild(fragment);
           this._hasDefaultTemplate = false;
         } else {
           this._hasDefaultTemplate = true;
           this._updateDefaultTemplate();
         }

         if (this.hasAttribute('ripple') && !util.findChild(button, 'ons-ripple')) {
           button.insertBefore(document.createElement('ons-ripple'), button.firstChild);
         }

         ModifierUtil.initModifier(this, scheme$16);

         this.setAttribute('_compiled', '');
       }
     }, {
       key: '_updateDefaultTemplate',
       value: function _updateDefaultTemplate() {
         if (!this._hasDefaultTemplate) {
           return;
         }

         var button = util.findChild(this, '.tab-bar__button');

         var template = defaultInnerTemplateSource.cloneNode(true);
         while (template.children[0]) {
           button.appendChild(template.children[0]);
         }

         var self = this;
         var icon = this.getAttribute('icon');
         var label = this.getAttribute('label');

         if (typeof icon === 'string') {
           getIconElement().setAttribute('icon', icon);
         } else {
           var wrapper = button.querySelector('.tab-bar__icon');
           wrapper.parentNode.removeChild(wrapper);
         }

         if (typeof label === 'string') {
           getLabelElement().textContent = label;
         } else {
           getLabelElement().parentNode.removeChild(getLabelElement());
         }

         function getLabelElement() {
           return self.querySelector('.tab-bar__label');
         }

         function getIconElement() {
           return self.querySelector('ons-icon');
         }
       }
     }, {
       key: '_onClick',
       value: function _onClick() {
         var tabbar = this._findTabbarElement();
         if (tabbar) {
           tabbar.setActiveTab(this._findTabIndex());
         }
       }
     }, {
       key: 'setActive',
       value: function setActive() {
         var radio = util.findChild(this, 'input');
         radio.checked = true;
         this.classList.add('active');

         util.arrayFrom(this.querySelectorAll('[ons-tab-inactive], ons-tab-inactive')).forEach(function (element) {
           return element.style.display = 'none';
         });
         util.arrayFrom(this.querySelectorAll('[ons-tab-active], ons-tab-active')).forEach(function (element) {
           return element.style.display = 'inherit';
         });
       }
     }, {
       key: 'setInactive',
       value: function setInactive() {
         var radio = util.findChild(this, 'input');
         radio.checked = false;
         this.classList.remove('active');

         util.arrayFrom(this.querySelectorAll('[ons-tab-inactive], ons-tab-inactive')).forEach(function (element) {
           return element.style.display = 'inherit';
         });
         util.arrayFrom(this.querySelectorAll('[ons-tab-active], ons-tab-active')).forEach(function (element) {
           return element.style.display = 'none';
         });
       }

       /**
        * @return {Boolean}
        */

     }, {
       key: 'isLoaded',
       value: function isLoaded() {
         return false;
       }

       /**
        * @param {Function} callback
        * @param {Function} link
        */

     }, {
       key: '_loadPageElement',
       value: function _loadPageElement(callback, link) {
         var _this2 = this;

         if (!this._pageElement) {
           this._createPageElement(this.getAttribute('page'), function (element) {
             link(element, function (element) {
               _this2._pageElement = element;
               callback(element);
             });
           });
         } else {
           callback(this._pageElement);
         }
       }

       /**
        * @param {String} page
        * @param {Function} callback
        */

     }, {
       key: '_createPageElement',
       value: function _createPageElement(page, callback) {
         internal.getPageHTMLAsync(page).then(function (html) {
           callback(util.createElement(html.trim()));
         });
       }

       /**
        * @return {Boolean}
        */

     }, {
       key: 'isActive',
       value: function isActive() {
         return this.classList.contains('active');
       }
     }, {
       key: 'detachedCallback',
       value: function detachedCallback() {
         this.removeEventListener('click', this._boundOnClick, false);
       }
     }, {
       key: 'attachedCallback',
       value: function attachedCallback() {
         var _this3 = this;

         this._ensureElementPosition();

         var tabbar = this._findTabbarElement();

         if (tabbar.hasAttribute('modifier')) {
           var prefix = this.hasAttribute('modifier') ? this.getAttribute('modifier') + ' ' : '';
           this.setAttribute('modifier', prefix + tabbar.getAttribute('modifier'));
         }

         if (this.hasAttribute('active')) {
           (function () {
             var tabIndex = _this3._findTabIndex();

             OnsTabbarElement$1.rewritables.ready(tabbar, function () {
               setImmediate(function () {
                 return tabbar.setActiveTab(tabIndex, { animation: 'none' });
               });
             });
           })();
         } else {
           OnsTabbarElement$1.rewritables.ready(tabbar, function () {
             setImmediate(function () {
               return _this3._createPageElement(_this3.getAttribute('page'), function (pageElement) {
                 OnsTabbarElement$1.rewritables.link(tabbar, pageElement, {}, function (pageElement) {
                   _this3._pageElement = pageElement;
                   _this3._pageElement.style.display = 'none';
                   tabbar._contentElement.appendChild(_this3._pageElement);
                 });
               });
             });
           });
         }

         this.addEventListener('click', this._boundOnClick, false);
       }
     }, {
       key: '_findTabbarElement',
       value: function _findTabbarElement() {
         if (this.parentNode && this.parentNode.nodeName.toLowerCase() === 'ons-tabbar') {
           return this.parentNode;
         }

         if (this.parentNode.parentNode && this.parentNode.parentNode.nodeName.toLowerCase() === 'ons-tabbar') {
           return this.parentNode.parentNode;
         }

         return null;
       }
     }, {
       key: '_findTabIndex',
       value: function _findTabIndex() {
         var elements = this.parentNode.children;
         for (var i = 0; i < elements.length; i++) {
           if (this === elements[i]) {
             return i;
           }
         }
       }
     }, {
       key: '_ensureElementPosition',
       value: function _ensureElementPosition() {
         if (!this._findTabbarElement()) {
           throw new Error('This ons-tab element is must be child of ons-tabbar element.');
         }
       }
     }, {
       key: 'attributeChangedCallback',
       value: function attributeChangedCallback(name, last, current) {
         if (this._hasDefaultTemplate) {
           if (name === 'icon' || name === 'label') {
             this._updateDefaultTemplate();
           }
         }

         if (name === 'modifier') {
           return ModifierUtil.onModifierChanged(last, current, this, scheme$16);
         }
       }
     }]);
     return TabElement;
   })(BaseElement);

   window.OnsTabElement = document.registerElement('ons-tab', {
     prototype: TabElement.prototype
   });

   document.registerElement('ons-tabbar-item', {
     prototype: Object.create(TabElement.prototype)
   });

   var scheme$18 = { '': 'toolbar-button--*' };

   /**
    * @element ons-toolbar-button
    * @category page
    * @modifier outline
    *   [en]A button with an outline.[/en]
    *   [ja]アウトラインをもったボタンを表示します。[/ja]
    * @description
    *   [en]Button component for ons-toolbar and ons-bottom-toolbar.[/en]
    *   [ja]ons-toolbarあるいはons-bottom-toolbarに設置できるボタン用コンポーネントです。[/ja]
    * @codepen aHmGL
    * @guide Addingatoolbar
    *   [en]Adding a toolbar[/en]
    *   [ja]ツールバーの追加[/ja]
    * @seealso ons-toolbar
    *   [en]ons-toolbar component[/en]
    *   [ja]ons-toolbarコンポーネント[/ja]
    * @seealso ons-back-button
    *   [en]ons-back-button component[/en]
    *   [ja]ons-back-buttonコンポーネント[/ja]
    * @seealso ons-toolbar-button
    *   [en]ons-toolbar-button component[/en]
    *   [ja]ons-toolbar-buttonコンポーネント[/ja]
    * @example
    * <ons-toolbar>
    *   <div class="left"><ons-toolbar-button>Button</ons-toolbar-button></div>
    *   <div class="center">Title</div>
    *   <div class="right"><ons-toolbar-button><ons-icon icon="ion-navicon" size="28px"></ons-icon></ons-toolbar-button></div>
    * </ons-toolbar>
    */

   var ToolbarButtonElement = (function (_BaseElement) {
     babelHelpers.inherits(ToolbarButtonElement, _BaseElement);

     function ToolbarButtonElement() {
       babelHelpers.classCallCheck(this, ToolbarButtonElement);
       return babelHelpers.possibleConstructorReturn(this, Object.getPrototypeOf(ToolbarButtonElement).apply(this, arguments));
     }

     babelHelpers.createClass(ToolbarButtonElement, [{
       key: 'createdCallback',

       /**
        * @attribute modifier
        * @type {String}
        * @description
        *   [en]The appearance of the button.[/en]
        *   [ja]ボタンの表現を指定します。[/ja]
        */

       /**
        * @attribute disabled
        * @description
        *   [en]Specify if button should be disabled.[/en]
        *   [ja]ボタンを無効化する場合は指定してください。[/ja]
        */

       value: function createdCallback() {
         if (!this.hasAttribute('_compiled')) {
           this._compile();
         }
       }
     }, {
       key: '_compile',
       value: function _compile() {
         ons._autoStyle.prepare(this);

         this.classList.add('toolbar-button');

         ModifierUtil.initModifier(this, scheme$18);

         this.setAttribute('_compiled', '');
       }
     }, {
       key: 'attributeChangedCallback',
       value: function attributeChangedCallback(name, last, current) {
         if (name === 'modifier') {
           return ModifierUtil.onModifierChanged(last, current, this, scheme$18);
         }
       }
     }]);
     return ToolbarButtonElement;
   })(BaseElement);

   window.OnsToolbarButton = document.registerElement('ons-toolbar-button', {
     prototype: ToolbarButtonElement.prototype
   });

   var scheme$17 = {
     '': 'navigation-bar--*',
     '.navigation-bar__left': 'navigation-bar--*__left',
     '.navigation-bar__center': 'navigation-bar--*__center',
     '.navigation-bar__right': 'navigation-bar--*__right'
   };

   /**
    * @element ons-toolbar
    * @category page
    * @modifier transparent
    *   [en]Transparent toolbar[/en]
    *   [ja]透明な背景を持つツールバーを表示します。[/ja]
    * @description
    *   [en]Toolbar component that can be used with navigation. Left, center and right container can be specified by class names.[/en]
    *   [ja]ナビゲーションで使用するツールバー用コンポーネントです。クラス名により、左、中央、右のコンテナを指定できます。[/ja]
    * @codepen aHmGL
    * @guide Addingatoolbar [en]Adding a toolbar[/en][ja]ツールバーの追加[/ja]
    * @seealso ons-bottom-toolbar
    *   [en]ons-bottom-toolbar component[/en]
    *   [ja]ons-bottom-toolbarコンポーネント[/ja]
    * @seealso ons-back-button
    *   [en]ons-back-button component[/en]
    *   [ja]ons-back-buttonコンポーネント[/ja]
    * @seealso ons-toolbar-button
    *   [en]ons-toolbar-button component[/en]
    *   [ja]ons-toolbar-buttonコンポーネント[/ja]
    * @example
    * <ons-page>
    *   <ons-toolbar>
    *     <div class="left"><ons-back-button>Back</ons-back-button></div>
    *     <div class="center">Title</div>
    *     <div class="right">Label</div>
    *   </ons-toolbar>
    * </ons-page>
    */

   var ToolbarElement = (function (_BaseElement) {
     babelHelpers.inherits(ToolbarElement, _BaseElement);

     function ToolbarElement() {
       babelHelpers.classCallCheck(this, ToolbarElement);
       return babelHelpers.possibleConstructorReturn(this, Object.getPrototypeOf(ToolbarElement).apply(this, arguments));
     }

     babelHelpers.createClass(ToolbarElement, [{
       key: 'createdCallback',

       /**
        * @attribute inline
        * @initonly
        * @description
        *   [en]Display the toolbar as an inline element.[/en]
        *   [ja]ツールバーをインラインに置きます。スクロール領域内にそのまま表示されます。[/ja]
        */

       /**
        * @attribute modifier
        * @description
        *   [en]The appearance of the toolbar.[/en]
        *   [ja]ツールバーの表現を指定します。[/ja]
        */

       value: function createdCallback() {
         var _this2 = this;

         if (!this.hasAttribute('_compiled')) {
           this._compile();
         }

         this._tryToEnsureNodePosition();
         setImmediate(function () {
           return _this2._tryToEnsureNodePosition();
         });
       }
     }, {
       key: 'attributeChangedCallback',
       value: function attributeChangedCallback(name, last, current) {
         if (name === 'modifier') {
           return ModifierUtil.onModifierChanged(last, current, this, scheme$17);
         }
       }
     }, {
       key: 'attachedCallback',
       value: function attachedCallback() {
         var _this3 = this;

         this._tryToEnsureNodePosition();
         setImmediate(function () {
           return _this3._tryToEnsureNodePosition();
         });
       }
     }, {
       key: '_tryToEnsureNodePosition',
       value: function _tryToEnsureNodePosition() {
         if (!this.parentNode || this.hasAttribute('inline')) {
           return;
         }

         if (this.parentNode.nodeName.toLowerCase() !== 'ons-page') {
           var page = this;
           for (;;) {
             page = page.parentNode;

             if (!page) {
               return;
             }

             if (page.nodeName.toLowerCase() === 'ons-page') {
               break;
             }
           }
           page._registerToolbar(this);
         }
       }

       /**
        * @return {HTMLElement}
        */

     }, {
       key: '_getToolbarLeftItemsElement',
       value: function _getToolbarLeftItemsElement() {
         return this.querySelector('.left') || ons$1._internal.nullElement;
       }

       /**
        * @return {HTMLElement}
        */

     }, {
       key: '_getToolbarCenterItemsElement',
       value: function _getToolbarCenterItemsElement() {
         return this.querySelector('.center') || ons$1._internal.nullElement;
       }

       /**
        * @return {HTMLElement}
        */

     }, {
       key: '_getToolbarRightItemsElement',
       value: function _getToolbarRightItemsElement() {
         return this.querySelector('.right') || ons$1._internal.nullElement;
       }

       /**
        * @return {HTMLElement}
        */

     }, {
       key: '_getToolbarBackButtonLabelElement',
       value: function _getToolbarBackButtonLabelElement() {
         return this.querySelector('ons-back-button .back-button__label') || ons$1._internal.nullElement;
       }
     }, {
       key: '_compile',
       value: function _compile() {
         ons$1._autoStyle.prepare(this);

         var inline = this.hasAttribute('inline');

         this.classList.add('navigation-bar');

         if (!inline) {
           this.style.position = 'absolute';
           this.style.zIndex = '10000';
           this.style.left = '0px';
           this.style.right = '0px';
           this.style.top = '0px';
         }

         this._ensureToolbarItemElements();

         ModifierUtil.initModifier(this, scheme$17);

         this.setAttribute('_compiled', '');
       }
     }, {
       key: '_ensureToolbarItemElements',
       value: function _ensureToolbarItemElements() {

         var hasCenterClassElementOnly = this.children.length === 1 && this.children[0].classList.contains('center');
         var center;

         for (var i = 0; i < this.childNodes.length; i++) {
           // case of not element
           if (this.childNodes[i].nodeType != 1) {
             this.removeChild(this.childNodes[i]);
           }
         }

         if (hasCenterClassElementOnly) {
           center = this._ensureToolbarItemContainer('center');
         } else {
           center = this._ensureToolbarItemContainer('center');
           var left = this._ensureToolbarItemContainer('left');
           var right = this._ensureToolbarItemContainer('right');

           if (this.children[0] !== left || this.children[1] !== center || this.children[2] !== right) {
             if (left.parentNode) {
               this.removeChild(left);
             }
             if (center.parentNode) {
               this.removeChild(center);
             }
             if (right.parentNode) {
               this.removeChild(right);
             }

             var fragment = document.createDocumentFragment();
             fragment.appendChild(left);
             fragment.appendChild(center);
             fragment.appendChild(right);

             this.appendChild(fragment);
           }
         }
         center.classList.add('navigation-bar__title');
       }
     }, {
       key: '_ensureToolbarItemContainer',
       value: function _ensureToolbarItemContainer(name) {
         var container = ons$1._util.findChild(this, '.' + name);

         if (!container) {
           container = document.createElement('div');
           container.classList.add(name);
         }

         container.classList.add('navigation-bar__' + name);
         return container;
       }
     }]);
     return ToolbarElement;
   })(BaseElement);

   window.OnsToolbarElement = document.registerElement('ons-toolbar', {
     prototype: ToolbarElement.prototype
   });

   var scheme$19 = {
     '.range': 'range--*',
     '.range__left': 'range--*__left'
   };

   var INPUT_ATTRIBUTES$1 = ['autofocus', 'disabled', 'inputmode', 'max', 'min', 'name', 'placeholder', 'readonly', 'size', 'step', 'validator', 'value'];

   /**
    * @element ons-range
    * @category form
    * @description
    *   [en]Range input component.[/en]
    *   [ja][/ja]
    * @codepen xZQomM
    * @guide UsingFormComponents
    *   [en]Using form components[/en]
    *   [ja]フォームを使う[/ja]
    * @guide EventHandling
    *   [en]Event handling descriptions[/en]
    *   [ja]イベント処理の使い方[/ja]
    * @example
    * <ons-range value="20"></ons-range>
    * <ons-range modifier="material" value="10"></range>
    */

   var MaterialInputElement$1 = (function (_BaseElement) {
     babelHelpers.inherits(MaterialInputElement, _BaseElement);

     function MaterialInputElement() {
       babelHelpers.classCallCheck(this, MaterialInputElement);
       return babelHelpers.possibleConstructorReturn(this, Object.getPrototypeOf(MaterialInputElement).apply(this, arguments));
     }

     babelHelpers.createClass(MaterialInputElement, [{
       key: 'createdCallback',
       value: function createdCallback() {
         if (!this.hasAttribute('_compiled')) {
           this._compile();
         }

         this._updateBoundAttributes();
         this._onChange();
       }
     }, {
       key: '_compile',
       value: function _compile() {
         ons._autoStyle.prepare(this);

         this.innerHTML = '\n      <input type="range" class="range">\n      <div class="range__left"></div>\n    ';

         ModifierUtil.initModifier(this, scheme$19);

         this.setAttribute('_compiled', '');
       }
     }, {
       key: '_onChange',
       value: function _onChange() {
         this._left.style.width = 100 * this._ratio + '%';
       }
     }, {
       key: 'attributeChangedCallback',
       value: function attributeChangedCallback(name, last, current) {
         if (name === 'modifier') {
           ModifierUtil.onModifierChanged(last, current, this, scheme$19);
         } else if (INPUT_ATTRIBUTES$1.indexOf(name) >= 0) {
           this._updateBoundAttributes();

           if (name === 'min' || name === 'max') {
             this._onChange();
           }
         }
       }
     }, {
       key: 'attachedCallback',
       value: function attachedCallback() {
         this.addEventListener('input', this._onChange);
       }
     }, {
       key: 'detachedCallback',
       value: function detachedCallback() {
         this.removeEventListener('input', this._onChange);
       }
     }, {
       key: '_updateBoundAttributes',
       value: function _updateBoundAttributes() {
         var _this2 = this;

         INPUT_ATTRIBUTES$1.forEach(function (attr) {
           if (_this2.hasAttribute(attr)) {
             _this2._input.setAttribute(attr, _this2.getAttribute(attr));
           } else {
             _this2._input.removeAttribute(attr);
           }
         });
       }
     }, {
       key: '_ratio',
       get: function get() {
         // Returns the current ratio.
         var min = this._input.min === '' ? 0 : parseInt(this._input.min);
         var max = this._input.max === '' ? 100 : parseInt(this._input.max);

         return (this.value - min) / (max - min);
       }
     }, {
       key: '_input',
       get: function get() {
         return this.querySelector('input');
       }
     }, {
       key: '_left',
       get: function get() {
         return this.querySelector('.range__left');
       }
     }, {
       key: 'value',
       get: function get() {
         return this._input.value;
       },
       set: function set(val) {
         this._input.value = val;
         this._onChange();
         return this._input.val;
       }
     }]);
     return MaterialInputElement;
   })(BaseElement);

   window.OnsRangeElement = document.registerElement('ons-range', {
     prototype: MaterialInputElement$1.prototype
   });

   // fastclick
   window.addEventListener('load', function () {
     return FastClick.attach(document.body);
   }, false);

   // ons._defaultDeviceBackButtonHandler
   window.addEventListener('DOMContentLoaded', function () {
     ons$1._deviceBackButtonDispatcher.enable();
     ons$1._defaultDeviceBackButtonHandler = ons$1._deviceBackButtonDispatcher.createHandler(window.document.body, function () {
       navigator.app.exitApp();
     });
     document.body._gestureDetector = new ons$1.GestureDetector(document.body);
   }, false);

   // setup loading placeholder
   ons$1.ready(function () {
     ons$1._setupLoadingPlaceHolders();
   });

   // viewport.js
   new Viewport().setup();

   // modernize
   Modernizr.testStyles('#modernizr { -webkit-overflow-scrolling:touch }', function (elem, rule) {
     Modernizr.addTest('overflowtouch', window.getComputedStyle && window.getComputedStyle(elem).getPropertyValue('-webkit-overflow-scrolling') == 'touch');
   });

   return ons$1;

}));