const TooltipModule = function (fvdSynchronizer) {
  var ToolTip = function (fvdSynchronizer) {};
  ToolTip.prototype = {
    _container: null,
    _arrowLeftOffset: 14,
    _currentElement: null,
    displayImage: function (elem, imageSrc, event) {
      var html = '<img src="' + imageSrc + '"/>';
      this.display(elem, html, event);
    },
    display: function (elem, html, event) {
      event.stopPropagation();
      if (this._currentElement == elem) {
        return;
      }
      this._currentElement = elem;
      var that = this;
      var setFunction = function () {
        var contentContainer = document.getElementById('tiptip_content');
        contentContainer.innerHTML = html;
        var toolTipContainer = document.getElementById('tiptip_holder').cloneNode(true);
        that._container = toolTipContainer;
        // position
        var offset = fvdSynchronizer.Utils.getOffset(elem);
        toolTipContainer.style.left =
          offset.left + elem.offsetWidth / 2 - that._arrowLeftOffset - 1 + 'px';
        toolTipContainer.style.top = offset.top + elem.offsetHeight + 1 + 'px';
        document.body.appendChild(that._container);

        setTimeout(function () {
          toolTipContainer.setAttribute('active', 1);
          that._assignClickListener();
        }, 0);
      };
      if (this._container) {
        this.close(setFunction);
      } else {
        setFunction();
      }
    },
    close: function (callback) {
      const that = this;

      try {
        that._container.setAttribute('active', 0);
        that._container.parentNode.removeChild(that._container);
        that._container = null;
        that._currentElement = null;
        that._removeClickListener();
        if (callback) {
          callback();
        }
      } catch (ex) {}
    },
    _clickListener: function (event) {
      if (fvdSynchronizer.ToolTip._container) {
        var el = event.target;
        do {
          if (el == fvdSynchronizer.ToolTip._container) {
            return;
          }
          el = el.parentNode;
        } while (el);
      }
      fvdSynchronizer.ToolTip.close();
    },
    _assignClickListener: function () {
      document.addEventListener('click', fvdSynchronizer.ToolTip._clickListener, false);
    },
    _removeClickListener: function () {
      document.removeEventListener('click', fvdSynchronizer.ToolTip._clickListener);
    },
  };
  fvdSynchronizer.ToolTip = new ToolTip(fvdSynchronizer);
};
export default TooltipModule;
