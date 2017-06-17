import _ from 'lodash';

const
    DEFAULT_FIELD_WIDTH = 9,
    DEFAULT_FIELD_HEIGHT = 9,
    DEFAULT_NUMBER_OF_MINES = 10;

export default function (fieldWidth = DEFAULT_FIELD_WIDTH,
                         fieldHeight = DEFAULT_FIELD_HEIGHT,
                         numberOfMines = DEFAULT_NUMBER_OF_MINES) {

    const
        totalSquares = fieldWidth * fieldHeight,
        mineSet = new Set(_.shuffle(_.range(totalSquares)).slice(-numberOfMines)),
        flagSet = new Set(),
        revealSet = new Set(),
        indexToCoordinates = (index) => [index % fieldWidth, ~~(index / fieldWidth)],
        coordinatesToIndex = ([x, y]) => y * fieldWidth + x,
        siblingCoordinates = ([x, y]) => [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]].map(([ax, ay]) => [ax + x, ay + y]).filter(([x, y]) => _.inRange(x, 0, fieldWidth) && _.inRange(y, 0, fieldHeight));

    return {
        toggleFlag: _.flow(coordinatesToIndex, (squareIndex) => {
            if (!revealSet.has(squareIndex)) {
                flagSet[flagSet.has(squareIndex) ? "delete" : flagSet.size < numberOfMines ? "add" : "has"](squareIndex);
            }
        }),
        revealSquare: (coordinates) => {
            const scanAndReveal = (coordinates) => {
                let squareIndex = coordinatesToIndex(coordinates);
                if ([revealSet, flagSet].some((set) => set.has(squareIndex))) return;
                revealSet.add(squareIndex);
                if (mineSet.has(squareIndex)) return;
                let surroundingSiblings = siblingCoordinates(coordinates);
                !surroundingSiblings.map(coordinatesToIndex).some((index) => mineSet.has(index)) && surroundingSiblings.forEach(scanAndReveal);
            };

            scanAndReveal(coordinates);
        },
        getState: () => ({
            field: _.range(totalSquares).map((squareIndex) => {
                let
                    [x, y] = indexToCoordinates(squareIndex),
                    isRevealed = revealSet.has(squareIndex),
                    isMine = mineSet.has(squareIndex),
                    isFlag = flagSet.has(squareIndex);

                return _.assign({
                    x,
                    y,
                    isMine,
                    isFlag,
                    isRevealed
                }, isRevealed && !isMine && {surrounded: siblingCoordinates([x, y]).map(coordinatesToIndex).map((index) => mineSet.has(index)).filter(Boolean).length});
            }),
            is_dead: [...revealSet.values()].some((index) => mineSet.has(index)),
            is_win: flagSet.size === numberOfMines && [...flagSet.values()].every((index) => mineSet.has(index)),
            flags_left: numberOfMines - flagSet.size,
            width: fieldWidth,
            height: fieldHeight
        })
    };
};