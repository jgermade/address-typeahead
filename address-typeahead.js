/* global define */

(function (root, factory) {
  if( typeof module !== 'undefined' && module.exports ) {
    // CommonJS
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    define([], factory);
  } else {
    // Browser globals
    root.AddressTypeahead = factory();
  }
}(this, function () {

  function createElement (nodeName, attrs, content) {
    attrs = attrs || {};

    var node = document.createElement(nodeName);
    for( var key in attrs ) node[key] = attrs[key];

    if( typeof content === 'string' ) node.innerHTML = content;
    else if( content instanceof Array ) content.forEach(function (elem) {
      if( typeof elem === 'string' ) node.appendChild(createElement('div', {}, elem));
      else node.appendChild(elem);
    });

    return node;
  }

  function noop (value) { return value; }

  function safeFn(fn) {
    return typeof fn === 'function' ? fn : noop;
  }

  function extend(dest, src) {
    for( var key in src ) dest[key] = src[key];
    return dest;
  }

  function debounce (fn, duration) {
    duration = duration || 400;
    var waiting;

    return function () {
      var thisArg = this, args = arguments;

      if( waiting ) clearTimeout(waiting);
      waiting = setTimeout(function () {
        fn.apply(thisArg, args);
      }, duration);
    };

  }

  function serialize (o, nested) {
    var params = '';

    nested = nested || noop;

    for( var key in o ) {
      params += (params ? '&' : '') + key + '=' + nested(o[key]);
    }

    return params;
  }

  function getIndex (list, el) {
    for( var i = 0, n = list.length; i < n ; i++ ) {
      if( list[i] === el ) return i;
    }
    return -1;
  }

  function commaIf (text) {
    if( !text ) return '';
    return ', ' + text;
  }

  function address2Search (address, numberPlaceholder) {
    if( !address ) return '';
    console.log('address2Search', address);
    return address.street + ( commaIf(address.street_number) || (numberPlaceholder ? ', ' : '') ) + commaIf(address.city || address.locality);
  }

  // var closest = document.documentElement.closest ? function (el, s) {
  //   return el.closest(s);
  // } : function (el, s) {
  //   var matches = (el.document || el.ownerDocument).querySelectorAll(s), i;
  //   do {
  //       i = matches.length;
  //       while (--i >= 0 && matches.item(i) !== el) {};
  //   } while ((i < 0) && (el = el.parentElement));
  //   return el;
  // };

  var listen = document.documentElement.addEventListener ? function(element, eventName, listener, useCapture) {
      return element.addEventListener(eventName, listener, useCapture);
    } : function(element, eventName, listener, useCapture) {
      return element.attachEvent('on' + eventName, listener, useCapture);
    };
    // unlisten = document.documentElement.removeEventListener ? function(element, eventName, listener, useCapture) {
    //   return element.removeEventListener(eventName, listener, useCapture);
    // } : function(element, eventName, listener, useCapture) {
    //   return element.detachEvent('on' + eventName, listener, useCapture);
    // };

  var hasClass = document.documentElement.classList ? function (el, className) {
      return el.classList.contains(className);
    } : function (el, className) {
      return new RegExp('\\b' + (className || '') + '\\b','').test(el.className);
    },
    addClass = document.documentElement.classList ? function (el, className) {
      el.classList.add(className);
    } : function (el, className) {
      if( !hasClass(el, className) ) {
        el.className += ' ' + className;
      }
    },
    removeClass = document.documentElement.classList ? function (el, className) {
      el.classList.remove(className);
    } : function (el, className) {
      el.className = el.className.replace(new RegExp('\\s*' + className + '\\s*','g'), ' ');
    };

  // --------------------------------------------------------------------------

  function GooglePlaces (key, config) {
    this.key = key;
    this.config = config || {};
    this.onInit = [];
  }

  function loadGoogle (self) {
    self.$$google = true;
    var timestamp = new Date().getTime();
    window['__googleAPICallback__' + timestamp] = function () {
      delete window['__googleAPICallback__' + timestamp];

      var places = window.google.maps.places,
          div = document.createElement('div'),
          listeners = self.onInit;

      delete self.onInit;

      self.autocompleteService = new places.AutocompleteService();
      self.placesService = new places.PlacesService(div);

      self.googlePredictionsOK = window.google.maps.places.PlacesServiceStatus.OK;

      self.onInit = false;
      listeners.forEach(function (listener) {
        listener(self);
      });
    };

    var script = window.document.createElement('script');
    script.src = 'https://maps.googleapis.com/maps/api/js?' + serialize({
      key: self.key,
      libraries: 'places',
      callback: '__googleAPICallback__' + timestamp
    });
    window.document.head.appendChild(script);
  }

  GooglePlaces.prototype.init = function (cb) {
    cb = typeof cb === 'function' ? cb : noop;
    if( !this.onInit ) return cb(this);

    this.onInit.push(cb);

    if( !this.$$google ) loadGoogle(this);
  };

  GooglePlaces.prototype.getPredictions = function (input, cb, onError) {

    var self = this;

    self.init(function () {
      self.autocompleteService.getPlacePredictions( extend({
        input: input
      }, self.config ), function (predictions, status) {


        if( status != self.googlePredictionsOK ) {
          safeFn(onError)(status);
          return;
        }

        safeFn(cb)(predictions);
      });
    });

    return self;
  };

  GooglePlaces.prototype.getDetails = function (prediction, cb, onError) {
    this.placesService.getDetails(prediction, function (place, result) {
      if( result === 'OK' ) safeFn(cb)(place);
      else safeFn(onError)(result);
    });
  };

  GooglePlaces.prototype.licenseHTML = '<img src="https://developers.google.com/places/documentation/images/powered-by-google-on-white.png?hl=es-419"/>';

  GooglePlaces.prototype.getPredictionHTML = function (prediction) {
    var cursor = 0, src = prediction.description, result = '', from, len;

    for( var i = 0, n = prediction.matched_substrings.length; i < n ; i++ ) {
      from = prediction.matched_substrings[i].offset;
      len = prediction.matched_substrings[i].length;
      result += src.substr(cursor, from - cursor);
      result += '<strong>' + src.substr(from, len) + '</strong>';
      cursor = from + len;
    }

    result += src.substr(cursor);

    return result;
  };

  GooglePlaces.parsePlace = function (place) {
    var fields = {};

    place.address_components.forEach(function (component) {
      fields[ component.types[0] ] = component.long_name;
    });

    var address = {
      street: fields.route || place.name || '',
      street_number: fields.street_number,
      postcode: fields.postal_code || '',
      locality: fields.locality,
      sublocality: fields.sublocality_level_1,
      city: fields.administrative_area_level_2,
      state: fields.administrative_area_level_1
    };

    console.log('address', address);
    console.log('fields', fields);
    console.log('place', place);

    return {
      address: address,
      fields: fields,
      place: place
    };
  };

  // --------------------------------------------------------------------------

  function AddressTypeahead (type, key, config) {
    if( type === 'google' ) {
      this.places = new GooglePlaces(key, config.google);
      this.parsePlace = GooglePlaces.parsePlace;
    }

    this.config = config || {};
    this.messages = extend({
      number_missing: 'Falta el número de la calle'
    }, this.config.messages || {});

    if( !this.places ) throw new Error('typeahead `' + type + '` not supported');
  }

  AddressTypeahead.GooglePlaces = GooglePlaces;

  AddressTypeahead.prototype.bind = function (input, onValidPlace, appendTo) {
    input = typeof input === 'string' ? document.querySelector(input) : input;
    this.input = input;

    var ta = this,
        places = this.places,
        predictionsCache = {},
        predictionsWrapper = createElement('div', { className: 'predictions' }),
        wrapper = createElement('div', { className: 'typeahead-predictions' }, [
          predictionsWrapper, createElement('div', { className: 'typeahead-license' }, places.licenseHTML)
        ]),
        predictions = [],
        selectedCursor = -1,
        addressResult = null,
        renderPredictions = function (_predictions, cb, beforeRender) {
          var i, n, children = predictionsWrapper.children;

          predictions = _predictions;

          safeFn(beforeRender)();

          if( predictions.length > children.length ) {
            for( i = 0, n = predictions.length - children.length ; i < n ; i++ ) {
              predictionsWrapper.appendChild( createElement('div', { className: 'prediction' }) );
            }
          }

          for( i = 0, n = predictions.length; i < n ; i++ ) {
            children[i].innerHTML = places.getPredictionHTML(predictions[i]);
            if( i === selectedCursor ) addClass(children[i], 'selected');
            else removeClass(children[i], 'selected');
          }

          if( predictions.length < children.length ) {
            while( children[predictions.length] ) {
              predictionsWrapper.removeChild(children[predictions.length]);
            }
          }

          safeFn(cb)();
        };

    ( appendTo ? ( typeof appendTo === 'string' ? document.querySelector(appendTo) : appendTo ) : document.body ).appendChild(wrapper);

    var numDebounced = 0,
        debouncedPredictions = debounce(function (value, loading, cb) {
          loading();
          places.getPredictions(value, cb);
        }),
        fetchResults = function (value, cb, beforeRender) {

          addressResult = null;

          if( value ) {
            if( predictionsCache[value] ) {
              renderPredictions(predictionsCache[value], cb, beforeRender);
            } else {
              var sec = ++numDebounced;
              debouncedPredictions(value, function () {
                addClass(wrapper, 'js-typeahead-loading');
              }, function (results) {
                if( sec !== numDebounced ) return;
                removeClass(wrapper, 'js-typeahead-loading');
                predictionsCache[value] = results;
                renderPredictions(results, cb, beforeRender);
              });
            }
          } else {
            renderPredictions([], cb, beforeRender);
          }
        },
        onPlace = function (place) {
          addressResult = ta.parsePlace(place);

          var address = addressResult.address;

          input.value = address2Search( address, true );

          if( address.street_number ) {
            input.setCustomValidity('');
            removeClass(input, 'waiting-number');
            safeFn(onValidPlace)(addressResult);
          } else {
            input.setCustomValidity(ta.messages.number_missing);
            addClass(input, 'waiting-number');
            if( document.activeElement !== input ) input.focus();
            input.setSelectionRange(address.street.length + 2, address.street.length + 2);
          }

        };

    var lastValue = null;

    function waitingNumber () {
      return addressResult && addressResult.address.street_number === undefined;
    }

    function focusAddressNumber () {
      if( addressResult ) {
        setTimeout(function () {
          if( document.activeElement !== input ) input.focus();
          input.setSelectionRange(addressResult.address.street.length + 2, addressResult.address.street.length + 2);
        }, 0);
      }
    }

    function onInput (_e) {
      var value = this.value, currentAddress = addressResult;
      fetchResults(value, function () {
        if( currentAddress && predictions.length === 1 ) {
          addressResult = currentAddress;
          places.getDetails(predictions[0], onPlace);
        }
      }, function () {
        if( lastValue === null || value !== lastValue ) {
          selectedCursor = predictions.length ? 0 : -1;
          lastValue = value;
        }
      });
    }

    listen(input, 'input', onInput);
    listen(input, 'change', onInput);

    listen(document.body, 'mousedown', function (e) {
      var el = e.target, cursor;

      while( el ) {
        if( hasClass(el, 'prediction') ) {
          cursor = getIndex(predictionsWrapper.children, el);
        } else if( el === predictionsWrapper ) {
          if( cursor >= 0 ) {
            selectedCursor = cursor;
            places.getDetails(predictions[cursor], onPlace);
          }
          break;
        }
        el = el.parentElement;
      }
    }, true);

    listen(input, 'keydown', function (e) {
      var children = predictionsWrapper.children,
          cursorLastChild = children.length - 1, nextCursor;

      switch( e.keyCode ) {
        case 38:
          if( !predictionsWrapper.children.length ) return;
          e.preventDefault();
          nextCursor = selectedCursor >= 0 ? (selectedCursor > 0 ? (selectedCursor - 1) : 0) : cursorLastChild;
          if( nextCursor === selectedCursor ) return;
          if( children[selectedCursor] ) removeClass(children[selectedCursor], 'selected');
          addClass(children[nextCursor], 'selected');
          selectedCursor = nextCursor;
          break;
        case 40:
          if( !predictionsWrapper.children.length ) return;
          e.preventDefault();
          nextCursor = selectedCursor >= 0 ? (selectedCursor < cursorLastChild ? (selectedCursor + 1) : selectedCursor) : 0;
          if( nextCursor === selectedCursor ) return;
          if( children[selectedCursor] ) removeClass(children[selectedCursor], 'selected');
          addClass(children[nextCursor], 'selected');
          selectedCursor = nextCursor;
          break;
        case 13:
          if( !addressResult ) e.preventDefault();
          break;
      }
    });

    if( document.activeElement !== input ) wrapper.style.display = 'none';

    listen(input, 'focus', function () {
      if( addressResult && addressResult.address.street_number === undefined ) {
        setTimeout(function () {
          input.setSelectionRange(addressResult.address.street.length + 2, addressResult.address.street.length + 2);
        }, 0);
      }

      wrapper.style.display = null;
    });

    listen(input, 'blur', function (e) {
      if( !addressResult && predictionsWrapper.children[selectedCursor] ) {
        places.getDetails(predictions[selectedCursor], function (details) {
          onPlace(details);
          if( addressResult ) {
            if( addressResult.address.street_number ) {
              wrapper.style.display = 'none';
              input.blur();
            } else {
              focusAddressNumber();
            }
          }
        });
        e.preventDefault();
        focusAddressNumber();
        return;
      }
      if( waitingNumber() ) {
        e.preventDefault();
        focusAddressNumber();
        return;
      }
      wrapper.style.display = 'none';
    });

    listen(input, 'click', function () {
      wrapper.style.display = null;

      if( this.value !== lastValue ) fetchResults(this.value, function () {
        wrapper.style.display = null;
      });

      if( document.activeElement !== input && waitingNumber() ) focusAddressNumber();
    });

    return this;
  };

  AddressTypeahead.prototype.unbind = function () { return this; };

  return AddressTypeahead;

}));
