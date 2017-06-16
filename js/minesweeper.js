const
    DEFAULT_FIELD_WIDTH = 9,
    DEFAULT_FIELD_HEIGHT = 9,
    DEFAULT_NUMBER_OF_MINES = 10,
    SECOND = 1000;

// Game controller
const gameControllerFactory = function(
    fieldWidth = DEFAULT_FIELD_WIDTH,
    fieldHeight = DEFAULT_FIELD_HEIGHT,
    numberOfMines = DEFAULT_NUMBER_OF_MINES
){

    const
        totalSquares = fieldWidth * fieldHeight,
        mineSet = new Set(_.shuffle(_.range(totalSquares)).slice(-numberOfMines)),
        flagSet = new Set(),
        revealSet = new Set(),
        indexToCoordinates = (index)=> [index % fieldWidth, ~~(index / fieldWidth)],
        coordinatesToIndex = ([x, y])=> y * fieldWidth + x,
        siblingCoordinates = ([x, y])=> [[0,-1], [1,-1], [1,0], [1,1], [0,1], [-1,1], [-1,0], [-1,-1]].map(([ax,ay])=> [ax+x, ay+y]).filter(([x,y])=> _.inRange(x, 0, fieldWidth) && _.inRange(y, 0, fieldHeight));

    return {
        toggleFlag: _.flow(coordinatesToIndex, (squareIndex)=> {
            if(!revealSet.has(squareIndex)){
                flagSet[flagSet.has(squareIndex) ? "delete" : flagSet.size < numberOfMines ? "add" : "has"](squareIndex);
            }
        }),
        revealSquare: (coordinates)=> {
            const scanAndReveal = (coordinates)=> {
                let squareIndex = coordinatesToIndex(coordinates);
                if([revealSet, flagSet].some((set)=> set.has(squareIndex))) return;
                revealSet.add(squareIndex);
                if(mineSet.has(squareIndex)) return;
                let surroundingSiblings = siblingCoordinates(coordinates);
                !surroundingSiblings.map(coordinatesToIndex).some((index)=> mineSet.has(index)) && surroundingSiblings.forEach(scanAndReveal);
            };

            scanAndReveal(coordinates);
        },
        getState: ()=> ({
            field: _.range(totalSquares).map((squareIndex)=> {
                let
                    [x,y] = indexToCoordinates(squareIndex),
                    isRevealed = revealSet.has(squareIndex),
                    isMine = mineSet.has(squareIndex),
                    isFlag = flagSet.has(squareIndex);

                return _.assign({
                    x,
                    y,
                    isMine,
                    isFlag,
                    isRevealed
                }, isRevealed && !isMine && { surrounded: siblingCoordinates([x,y]).map(coordinatesToIndex).map((index)=> mineSet.has(index)).filter(Boolean).length });
            }),
            is_dead: [...revealSet.values()].some((index)=> mineSet.has(index)),
            is_win: flagSet.size === numberOfMines && [...flagSet.values()].every((index)=> mineSet.has(index)),
            flags_left: numberOfMines - flagSet.size,
            width: fieldWidth,
            height: fieldHeight
        })
    };
};

// Set a communication bus
const
    uiBus = Kefir.pool(),
    filterUiStream = (stream, type)=> stream.filter(_.matches({ type })),
    sendUiMessage = (message)=> uiBus.plug(Kefir.constant(message));

// Set the entire application logic as a single stream
let applicationLogicState = Kefir
    .combine([
        filterUiStream(uiBus, 'set_dimensions').map(({ width, height, mines })=> ({ width, height, mines })).toProperty(()=> ({ width: DEFAULT_FIELD_WIDTH, height: DEFAULT_FIELD_HEIGHT, mines: DEFAULT_NUMBER_OF_MINES })),
        filterUiStream(uiBus, 'new_game').toProperty(_.noop)
    ], _.identity)
    .flatMapLatest(({ width, height, mines })=> {
        let game = gameControllerFactory(width, height, mines);

        let hesitateState = Kefir
            .merge(["hesitate_start", "hesitate_stop"].map((eventName, index)=> filterUiStream(uiBus, eventName).map(()=> !index)))
            .toProperty(()=> false);

        let gameState = uiBus
            .filter(({ type })=> ["reveal", "flag"].includes(type))
            .map(({ type, x, y })=> {
                switch(type){
                    case "reveal":
                        game.revealSquare([x,y]);
                        break;
                    case "flag":
                        game.toggleFlag([x,y]);
                        break;
                }
            })
            .map(()=> game.getState())
            .toProperty(()=> game.getState());

        let timerState = gameState
            .skip(1)
            .take(1)
            .flatMap(()=> {
                let startTime = Date.now();
                return Kefir.fromPoll(1000, ()=> ~~((Date.now() - startTime) / 1000));
            })
            .toProperty(_.constant(0));

        return Kefir
            .combine([
                gameState,
                hesitateState.map((hesitate)=>({ hesitate })),
                timerState.map((timer)=>({ timer }))
            ], _.assign)
            .takeUntilBy(gameState.map(({ is_dead, is_win })=> (is_dead || is_win)).filter(Boolean).take(1).delay());
    })
    .toProperty();

let clockState = Kefir
    .merge([Kefir.fromPoll(SECOND, _.noop), Kefir.later()])
    .map(()=>{ let date = new Date(); return [date.getHours(), date.getMinutes()].map((n)=> _.padStart(n, 2, '0')).join(':'); })
    .skipDuplicates()
    .toProperty();

const sevenSegment = (function(div){
    return function(className, number){
        return div({ className: ["seven-segment", className].join(' ') }, number.toString().split('').map((numChar)=> div({ className: ["sprite", `n${numChar}`].join(' ') })));
    }
})((props = {}, children = [])=> React.createElement('div', props, [], ...children));

// Set alert box
applicationLogicState
     .sampledBy(
         applicationLogicState
            .map(({ is_dead, is_win })=> is_dead || is_win)
            .skipDuplicates()
            .filter(Boolean)
    )
    .onValue(({ is_dead, is_win })=> (is_dead || is_win) && _.delay(()=> alert(is_dead ? "Game Over!" : "You Won! Hurray!")));

// Set HTML state
applicationLogicState
    .combine(clockState.map((clock)=>({ clock })), _.assign)
    .debounce()
    .onValue((function(){
        const
            SQUARE_SIZE = 16,
            [ol, li, div, i, select, option, footer] = ["ol", "li", "div", "i", "select", "option", "footer"].map((elementName)=> _.partial(React.createElement, elementName));

        return function({ field, is_dead, width, height, flags_left, hesitate, clock, timer }){

            // Render board
            ReactDOM.render(
                div(_.assign({ className: "xp-machine" }, ((f)=>({ onMouseUp: f, onMouseLeave: f }))(()=> sendUiMessage({ type: "hesitate_stop" }))), [],
                    div({ className: "clock" }, [], [clock]),
                    div({ className: "minesweeper" }, [],
                        select({ className: "difficulty", onChange: ({ target: { value } })=> sendUiMessage(_.assign({ type: "set_dimensions" }, _.zipObject(["width", "height", "mines"], value.split('x').map(Number)))) }, [], ...[
                            { title: "Beginner", width: 9, height: 9, mines: 10 },
                            { title: "Intermediate", width: 16, height: 16, mines: 40 },
                            { title: "Expert", width: 30, height: 16, mines: 99 }
                        ].map(({ title, width, height, mines })=> option({ value: [width,height, mines].join('x') }, [title]))),
                        sevenSegment('flag-left-counter', _.padStart(flags_left, 3, '0')),
                        sevenSegment('timer-counter', _.padStart(Math.min(timer, 999), 3, '0')),
                        i({
                            className: ["status", "sprite", hesitate ? "hesitate" : is_dead ? "dead" : "alive"].join(' '),
                            onClick: ()=> sendUiMessage({ type: "new_game" })
                        }),
                        ol({
                            className: "board",
                            style: {
                                width: SQUARE_SIZE * width,
                                height: SQUARE_SIZE * height
                            }
                        }, field.map(({ type, x, y, surrounded, isFlag, isMine, isRevealed }, index)=> {
                            return li({
                                key: index,
                                style: { top: y * SQUARE_SIZE, left: x * SQUARE_SIZE },
                                className: _.compact([
                                    "sprite",
                                    isFlag && !(is_dead && isMine) && "flag",
                                    ((is_dead && isMine) || isRevealed) && "reveal",
                                    isMine && is_dead && (isFlag ? "found-mine" : isRevealed ? "mine" : "unfound-mine"),
                                    isRevealed && [, "one", "two", "three", "four", "five", "six", "seven", "eight"][surrounded]]).join(' '),
                                onClick: ({ shiftKey })=> sendUiMessage({ type: shiftKey ? "flag" : "reveal", x, y }),
                                onContextMenu: (e)=> { e.preventDefault(); sendUiMessage({ type: "flag", x, y }); },
                                onMouseDown: ({ button })=> { !button && sendUiMessage({ type: "hesitate_start" }); }
                            })
                        }))
                    )
                ),
                document.querySelector('body')
            );
        }
})());