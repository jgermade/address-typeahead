
(function (root, factory) {
  if( typeof module !== 'undefined' && module.exports ) {
    // CommonJS
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    define([], factory);
  } else {
    // Browser globals
    root.Typeahead = factory();
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
    var params = '',
        nested = nested || noop;

    for( var key in o ) {
      params += (params ? '&' : '') + key + '=' + nested(o[key]);
    }

    return params;
  }

  function getIndex (list, el) {
    var index = -5;
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
    return address.street + ( commaIf(address.street_number) || (numberPlaceholder ? ', ' : '') ) + commaIf(address.locality || address.city);
  };

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
    },
    unlisten = document.documentElement.removeEventListener ? function(element, eventName, listener, useCapture) {
      return element.removeEventListener(eventName, listener, useCapture);
    } : function(element, eventName, listener, useCapture) {
      return element.detachEvent('on' + eventName, listener, useCapture);
    };

  var hasClass = document.documentElement.classList ? function (el, className) {
      return el.classList.contains(className);
    } : function (el, className) {
      return new RegExp('\\b' + (className || '') + '\\b','').test(el.className);
    },
    addClass = document.documentElement.classList ? function (el, className) {
      el.classList.add(className);
    } : function (el, className) {
      if( !classListHas(el, className) ) {
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

      // console.log('placesService div', div);
      // document.body.append(div);

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
    return prediction.description;
  }

  GooglePlaces.prototype.parsePlace = function (place) {
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

    // address.$$fields = fields;
    // address.$$place = place;

    return {
      address: address,
      fields: fields,
      place: place
    };
  }

  // --------------------------------------------------------------------------

  function Typeahead (type, key, config) {
    if( type === 'google' ) this.places = new GooglePlaces(key, config.google);

    this.config = config || {};
    this.messages = extend({
      number_missing: 'Falta el número de la calle'
    }, this.config.messages || {});

    if( !this.places ) throw new Error('typeahead `' + type + '` not supported');
  }

  Typeahead.prototype.bind = function (input, onValidPlace, wrapperSelector) {
    input = typeof input === 'string' ? document.querySelector(input) : input;
    this.input = input;

    var ta = this,
        places = this.places,
        predictionsCache = {},
        predictionsWrapper = createElement('div', { className: 'predictions' });
        wrapper = createElement('div', { className: 'typeahead-predictions' }, [
          predictionsWrapper, createElement('div', { className: 'typeahead-license' }, places.licenseHTML)
        ]),
        predictions = [],
        selectedCursor = -1,
        waitingNumber = false,
        addressResult = null,
        updatePredictions = function (_predictions) {
          var i, n, children = predictionsWrapper.children;
          console.log('predictions', _predictions);
          predictions = _predictions;

          if( predictions.length > 1 ) {
            wrapper.style.display = null;
          }

          if( waitingNumber || addressResult ) {
            if( predictions.length === 1 ) {
              console.log('prediction', predictions[0]);
              places.getDetails(predictions[0], onPlace);
              return;
            }
          }

          if( children[selectedCursor] ) removeClass(children[selectedCursor], 'selected');
          selectedCursor = -1;

          if( predictions.length > children.length ) {
            for( i = 0, n = predictions.length - children.length ; i < n ; i++ ) {
              predictionsWrapper.appendChild( createElement('div', { className: 'prediction' }) );
            }
          }

          for( i = 0, n = predictions.length; i < n ; i++ ) {
            children[i].innerHTML = places.getPredictionHTML(predictions[i]);
            if( i ) removeClass(children[i], 'selected');
            else addClass(children[i], 'selected');
          }

          if( predictions.length < children.length ) {
            while( children[predictions.length] ) {
              predictionsWrapper.removeChild(children[predictions.length]);
            }
          }

          if( predictions.length ) {
            selectedCursor = 0;
          }

          waitingNumber = false;
        };

    ( wrapperSelector ? document.querySelector(wrapperSelector) : document.body ).appendChild(wrapper);

    var debouncedPredictions = debounce(function (value, cb) {
          places.getPredictions(value, cb);
        }),
        fetchResults = function (value, cb) {
          if( value ) {
            predictionsCache[value] ? updatePredictions(predictionsCache[value]) : debouncedPredictions(value, function (results) {
              predictionsCache[value] = results;
              updatePredictions(results);
            });
          } else updatePredictions([]);
        },
        onPlace = function (place) {
          console.log('place', place, places.parsePlace(place) );
          addressResult = places.parsePlace(place);

          var address = addressResult.address;

          input.value = address2Search( address, true );

          wrapper.style.display = 'none';
          
          if( address.street_number ) {
            input.setCustomValidity('');
            updatePredictions([]);
            safeFn(onValidPlace)(addressResult);
          } else {
            input.setCustomValidity(ta.messages.number_missing);
            waitingNumber = true;
            if( document.activeElement !== input ) input.focus();
            input.setSelectionRange(address.street.length + 2, address.street.length + 2);
          }
        };

    listen(input, 'input', function () {
      fetchResults(this.value);
      if( waitingNumber ) return;
      // wrapper.style.display = null;
    });

    listen(document.body, 'mousedown', function (e) {
      var el = e.target, prediction;

      while( el ) {
        if( hasClass(el, 'prediction') ) {
          prediction = getIndex(predictionsWrapper.children, el);
          // places.getDetails(predictions[getIndex(predictionsWrapper.children, el)], onPlace);
          // console.log( 'prediction', predictions[getIndex(predictionsWrapper.children, el)], getIndex(predictionsWrapper.children, el) );
          // break;
        } else if( el === predictionsWrapper ) {
          if( prediction >= 0 ) {
            places.getDetails(predictions[prediction], onPlace);
          }
          break;
        }
        el = el.parentElement;
      }

      wrapper.style.display = 'none';
    }, true);

    listen(input, 'keydown', function (e) {
      if( !waitingNumber ) wrapper.style.display = null;
      // console.log('code', e.keyCode);

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
          wrapper.style.display = null;
          break;
        case 40:
          if( !predictionsWrapper.children.length ) return;
          e.preventDefault();
          nextCursor = selectedCursor >= 0 ? (selectedCursor < cursorLastChild ? (selectedCursor + 1) : selectedCursor) : 0;
          if( nextCursor === selectedCursor ) return;
          if( children[selectedCursor] ) removeClass(children[selectedCursor], 'selected');
          addClass(children[nextCursor], 'selected');
          selectedCursor = nextCursor;
          wrapper.style.display = null;
          break;
        case 13:
          e.preventDefault();
        case 9:
          if( children[selectedCursor] ) {
            places.getDetails(predictions[selectedCursor], onPlace);
            if( !waitingNumber ) wrapper.style.display = 'none';
          }
          break;
      }
    });

    wrapper.style.display = 'none';
    listen(input, 'focus', function () {
      if( waitingNumber ) return;
      // wrapper.style.display = null;
      fetchResults(this.value);
    });
    listen(input, 'click', function () {
      wrapper.style.display = null;
      if( this !== document.activeElement ) fetchResults(this.value);
    });

    return this;
  };

  Typeahead.prototype.unbind = function () { return this; };

  return Typeahead;

}));
