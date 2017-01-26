function Repository (grid, options){
    var self = this;
    this.grid = grid;
    this.offset = 0; //... from actual server data
    this.serverSize = 0;
    this.oldOffset = 0;
    this.frameSize = options.bufferLen || 1000; // How much data to request from the server
    this.minFrameSize = this.frameSize; //Lower bound of server request
    this.frameIncrement = 300; //How much to move the offset of the frame
    this.initialFrame = true; //Very very first frame for building Hypergrid schema
    this.newFrameRecieved = false; //First frame after moving offset
    this.pollLoopRunning = false; //Simulated blotter updates
    this.throttledDataReq = this._dataReq; //Request data at 60FPS, probably best to go a little slower
    this.debouncedScrollingHandler = debounce(this.checkScrollBars, 300);
    this.grid.addEventListener('fin-scroll-y', function(e) {
        self.debouncedScrollingHandler(e); //Handle scrolling after it has stopped for a brief delay
    });
}

Repository.prototype = {
    constructor: Repository,
    frame: [],
    onNewFrame: function(){},
    resizeFrame: function(scalar){
        this.viewPortLen = this.grid.renderer.visibleRows.length;
        this.frameSize = Math.max(this.viewPortLen * scalar, this.minFrameSize);
        this.frameSize = Math.min(this.frameSize, this.serverSize);
        this.frame.length = this.frameSize;
    },
    _dataReq: function(){
        if (this.connectionOpen) {
            //console.log("Requesting Data");
            this.ws.send(JSON.stringify({start: this.offset, end: this.frameSize + this.offset}));
        }
    },
    // getRow: function(relativeGridY){
    //     var y = this.resolveRowNum(relativeGridY),
    //         row = this.frame[y];
    //
    //         if (!row) {
    //             return null; //Missing rows will be drawn on next repaint call
    //         } else {
    //             return row;
    //         }
    // },
    // getRowCount: function () {
    //     if (this.connectionOpen) {
    //         return this.frameSize; //Should affect scrollbar size
    //     }
    //     return 0;
    // },
    // getValue: function(c, r){
    //     var row = this.getRow(r);
    //     if (!row) {
    //         return null;
    //     }
    //     return row[this.grid.behavior.dataModel.dataSource.schema[c].name];
    // },
    // resolveRowNum: function(relativeGridY){
    //     return relativeGridY;
    // },
    checkScrollBars: function(e){
        console.log("Handle Scroll");
        var vscrollValue = e.detail.value || grid.getVScrollValue(),
            oldVScollValue = e.detail.oldValue,
            minScroll = this.grid.sbVScroller.range.min,
            maxScroll = this.grid.sbVScroller.range.max,
            direction = vscrollValue - oldVScollValue,
            deltaMin = vscrollValue - minScroll,
            deltaMax = maxScroll - vscrollValue;

        if (direction > 0 && deltaMax < this.frameIncrement)  {
            this.reframe(this.frameIncrement);
        } else if (direction < 0 && deltaMin < this.frameIncrement){
            this.reframe(-this.frameIncrement);
        }
    },
    reframe: function(offset){
        console.log("reframe");
        if (this.offset === 0 && offset < 0) {
            //Already requesting the top most data
            console.log("reframe aborted for top");
            return;
        }

        if (offset > 0 && (offset + this.offset + this.frameSize) > this.serverSize) {
            //Already requesting the bottom most data
            console.log("reframe aborted for bottom");
            return;
        }

        this.stopPoll();
        this.oldOffset = this.offset;
        this.offset = this.offset + offset;
        this.offset = Math.max(this.offset, 0);
        this.throttledDataReq();
        this.onFetch();
        this.newFrameRecieved = false;
    },
    poll: function(){
        this.pollLoopRunning = true;
        // Could put this in a Webworker
        function pollLoop() {
            if (this.pollLoopRunning) {
                this.throttledDataReq();
                requestAnimationFrame(pollLoop.bind(this)); //throttling
            }
        }

        pollLoop.call(this);
    },
    stopPoll: function () {
        this.pollLoopRunning = false;
    },
    start: function () {
        var self = this;
        this.ws = new WebSocket('ws://localhost:3000');
        var msgs  = 0;
        var connection = this.ws;

        // When the connection is opened, get an initial payload to the server
        connection.onopen = function () {
            console.log("Connection Open");
            self.connectionOpen = true;
            self.ws.send(JSON.stringify({initial: true}));
            self.throttledDataReq({start: 0, end: self.frameSize});
        };

        // Log errors
        connection.onerror = function (error) {
            self.connectionOpen = false;
            self.stopPoll();
            console.error('WebSocket Error ' + error);
        };

        // Log errors
        connection.onclose = function () {
            self.connectionOpen = false;
            self.stopPoll();
            console.log("Connection closed");
        };

        // New Data from the server
        connection.onmessage = function (e) {
            var payload = JSON.parse(e.data);
            if (payload.dataLen) {
                self.serverSize = e.dataLen;
                return;
            }

            self.frame = payload;
            self.grid.setData(self.frame);

            //console.log("Received data: " + ++msgs);

            if (!self.newFrameRecieved) {
                self.newFrameRecieved = true;
                self.poll();

                if (!self.initialFrame) {
                    //self.grid.sbVScroller.index = self.frameSize - self.frameIncrement;
                    self.grid.setVScrollValue( self.frameSize - self.frameIncrement);
                }

                if (self.initialFrame) {
                    self.initialFrame = false;
                }
                setTimeout(self.onNewFrame, 0);
            }
        };
    }
};





// Returns a function, that, as long as it continues to be invoked rapidly, will not
// be triggered. The function will be called after it stops being called for
// N milliseconds. If `immediate` is passed, trigger the function on the
// leading edge, instead of the trailing.
function debounce(func, delay) {
    var timeout;
    return function(event, immediate) {
        var context = this, args = arguments;
        var later = function() {
            clearTimeout(timeout);
            return func.apply(context, args);
        };
        clearTimeout(timeout);
        if (immediate) {
            func.apply(context, args);
        } else {
            timeout = setTimeout(later, delay);
        }
    };
};


function curry(fn, args) {
    return function () {
        var fullArgs  = Array.prototype.concat.apply(arguments, args);
        Function.prototype.apply(fn, fullArgs);
    };
}