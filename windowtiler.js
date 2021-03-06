
// Let's pollute the global namespace with these two functions so that we can
// keep a normal object-oriented paradigm the rest of the time.

function toArray(obj) {
  return Array.prototype.slice.call(obj);
}


/**
 * Creates a new window tiler.
 * @constructor
 */
WindowTiler = function() {};


/**
 * Array of all the screens for this instance of Chrome.
 * @type {Array.<Object>}
 */
WindowTiler.prototype.screens;


/**
 * Array of windows that currently need repositioning.
 * @type {Array.<Object>}
 */
WindowTiler.prototype.windowsToReposition = [];


/**
 * Array of windows that currently need verifying.
 * @type {Array.<Object>}
 */
WindowTiler.prototype.windowsToVerify = [];


/**
 * Starts the whole process of tiling windows.
 * @param {chrome.windows.Tab} tab The tab from which the action was triggered.
 */
WindowTiler.prototype.start = function(tab) {
  chrome.system.display.getInfo(this.onReceivedDisplayData.bind(this));
};


WindowTiler.prototype.onReceivedDisplayData = function(screens) {
  this.screens = screens;
  chrome.windows.getAll({"populate" : false},
      this.onReceivedWindowsData.bind(this));
};


WindowTiler.prototype.findWindowsOnThisScreen = function(theWindows,
    theScreen, allScreens) {
  var windowsOnSelectedScreen = [];

  for (var eachWindow, i = 0; eachWindow = theWindows[i]; i++) {
    var maxOverlap = 0;
    var screenWithMaxOverlap;
    for (var eachScreen, j = 0; eachScreen = allScreens[j]; j++) {
      var overlap = WindowTilerUtils.rectangleOverlap(
          eachWindow.top, eachWindow.left, eachWindow.width, eachWindow.height,
          eachScreen.bounds.top, eachScreen.bounds.left,
              eachScreen.bounds.width, eachScreen.bounds.height);
      if (overlap >= maxOverlap) {
         maxOverlap = overlap;
         screenWithMaxOverlap = eachScreen;
      }
    }
    if (screenWithMaxOverlap == theScreen) {
      windowsOnSelectedScreen.push(eachWindow);
    }
  }
  return windowsOnSelectedScreen;
};


/**
 * Callback for when we received data about the currently open windows.
 * @param {Array.<chrome.windows.Window>} windows The array of open windows.
 */
WindowTiler.prototype.onReceivedWindowsData = function(windowsParam) {
  var filters = [];
  filters.push(this.windowIsNonMinimized);
  var filteredWindows = this.filterWindows(windowsParam, filters);

  var mainScreen;
  for (var i = 0, eachScreen; eachScreen = this.screens[i]; i++) {
    if (eachScreen.isPrimary) {
      mainScreen = eachScreen;
      break;
    }
  }

  if (!mainScreen) {
    alert('I cannot find the main screen! I\'m going to stop here, sorry.');
    return;
  }

  for (var i = 0, eachScreen; eachScreen = this.screens[i]; i++) {
    var windowsForThisScreen = this.findWindowsOnThisScreen(filteredWindows,
        eachScreen, this.screens);

    this.tileWindows(windowsForThisScreen, eachScreen);
  }
};


/**
 * Callback for when we're finished resizing a window.
 * @param {chrome.windows.Window} myWindow The window that has just finished
 * resizing.
 */
WindowTiler.prototype.finished = function(myWindow) {
  // Do nothing for now.
};


WindowTiler.prototype.windowIsNonMinimized = function(theWindow) {
  return theWindow.state != 'minimized';
};


WindowTiler.prototype.filterWindows = function(windowsParam, filters) {
  var filtered = [];
  for (var i = 0; i < windowsParam.length; i++) {
    var shouldAdd = true;
    for (var j = 0; j < filters.length; j++) {
      shouldAdd &= filters[j](windowsParam[i]);
    }
    if (shouldAdd) {
      filtered.push(windowsParam[i]);
    }
  }
  return filtered;
}


WindowTiler.prototype.processAllWindowRepositioningRequests = function() {
  if (this.windowsToReposition.length == 0) {
    //this.verifyAllPositions();
    this.finished();
    return;
  }
  var tile = this.windowsToReposition.shift();
  this.windowsToVerify.push(tile);
  this.repositionAndResizeWindow(tile,
      this.processAllWindowRepositioningRequests.bind(this));
};


/**
 * Utility function to resize a window with the given window ID with the given
 * dimensions, and call the given callback function.
 * @param {Object} tile An object containing all the necessary information to
 *     process the request.
 * @param {Function} callback The callback function to call once the window is
 *     resized.
 */
WindowTiler.prototype.repositionAndResizeWindow = function(tile, callback) {
  window.console.log('Repositioning window ' + tile.windowId + ' to ' +
      tile.width + 'x' + tile.height + ' + (' + tile.left + ', ' + tile.top + ')') ;
  chrome.windows.update(tile.windowId, {
    'left': tile.left,
    'top': tile.top,
    'width': tile.width,
    'height': tile.height,
    'state': 'normal'
  }, callback);
};


WindowTiler.prototype.verifyAllPositions = function() {
  var allMatch = true;
  for (var i = 0, toVerify; toVerify = this.windowsToVerify; i++) {
    
  }
};


WindowTiler.prototype.verifynewWindowPosition = function(tile, callback) {
  chrome.windows.get(tile.windowId, undefined, function(theWindow) {
    var comparison = WindowTilerUtils.compareAreas(tile, theWindow);
    if (comparison == 0) {
      console.log('Equal:', tile, ' and ', theWindow);
    } else {
      console.log('NOT Equal:', tile, ' and ', theWindow);
    }
    callback();
  });
};


/**
 * Adds a tile (which contains information about one of the tiles on the screen)
 * into the current context (array of computed tiles).
 * @param {number} left The left position to use for the added tile.
 * @param {number} top The top position to use for the added tile.
 * @param {number} width The width to use for the added tile.
 * @param {number} height The height to use for the added tile.
 * @param {Array.<Object>} tileContext The context to which to add the new tile.
 */
WindowTiler.prototype.pushTileIntoTileContext = function(left, top, width,
    height, tileContext) {
  tileContext.push({
    left: left,
    top: top,
    width: width,
    height: height
  });
  return tileContext;
};


/**
 * Computes the relevant tiles and pushes them into the given tile context, for
 * a zone on the screen defined by the arguments, and for the given number of
 * windows to tile.
 * @param {Array.<Object>} tileContext The tile context to which to add computed
 *     tiles.
 * @param {number} numWindows The number of windows left to tile.
 * @param {number} zoneX The X coordinate of the zone remaining to tile.
 * @param {number} zoneY The Y coordinate of the zone remaining to tile.
 * @param {number} zoneWidth The width of the zone remaining to tile.
 * @param {number} zoneHeight The height of the zone remaining to tile.
 */
WindowTiler.prototype.computeTiles = function(tileContext, numWindows, zoneX,
    zoneY, zoneWidth, zoneHeight) {
  if (window.console) {
    window.console.log('Computing tiles: ' + zoneX + ', ' + zoneY + ', ' +
        zoneWidth + ', ' + zoneHeight + ' for ' + numWindows + ' windows');
  }

  if (!numWindows) {
    return tileContext;
  }

  // Base case: only one window remains, we occupy the whole remaining space.
  if (numWindows == 1) {
    this.pushTileIntoTileContext(zoneX, zoneY, zoneWidth, zoneHeight,
        tileContext);
    return tileContext;
  }

  var halfNumWindows = Math.floor(numWindows / 2);
  if (zoneWidth > zoneHeight) {
    var halfWidth = Math.floor(zoneWidth / 2);
    tileContext = this.computeTiles(tileContext, halfNumWindows,
        zoneX, zoneY,
        halfWidth, zoneHeight);
    tileContext = this.computeTiles(tileContext,
        numWindows - halfNumWindows,
        zoneX + halfWidth + 1, zoneY,
        zoneWidth - halfWidth, zoneHeight);
  } else {
    var halfHeight = Math.floor(zoneHeight / 2);
    tileContext = this.computeTiles(tileContext, halfNumWindows,
        zoneX, zoneY,
        zoneWidth, halfHeight);
    tileContext = this.computeTiles(tileContext,
        numWindows - halfNumWindows,
        zoneX, zoneY + halfHeight + 1,
        zoneWidth, zoneHeight - halfHeight);
  }
  return tileContext;
};


/**
 * Tiles the windows given in an array as an argument over the available area
 * on the screen.
 */
WindowTiler.prototype.tileWindows = function(theWindows, theScreen) {
  var tileContext = [];
  window.console.log('Tiling ' + theWindows.length + ' windows on screen ');
  window.console.log(theScreen);
  // TODO: screen.avail* properties do not work well on Linux/GNOME.
  tileContext = this.computeTiles(tileContext, theWindows.length,
      theScreen.workArea.left, theScreen.workArea.top,
      theScreen.workArea.width, theScreen.workArea.height);
  for (var i = 0, tile; i < tileContext.length; i++) {
    var tileContextWithWindowId = tileContext[i];
    tileContextWithWindowId.windowId = theWindows[i].id;
    this.windowsToReposition.push(tileContextWithWindowId);
  }
  this.processAllWindowRepositioningRequests();
}
