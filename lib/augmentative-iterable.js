'use strict';

const {
  processActionResult,
  getAugmentIterable,
  end,
  getSkippedAugmentIterable,
  getIterableParameters,
} = require('./augments-utils');
const {
  YIELD,
  IGNORE,
  STOP,
  FLAT,
} = require('./augments-types');
const {
  getStack,
} = require('./liked-list');

function resolveState(augmentList, wrapper) {
  wrapper.state = YIELD;
  let ai = augmentList.next;
  while (ai) {
    const actionResult = ai.action ? ai.action(wrapper.result) : wrapper.result;
    wrapper.type = ai.type;
    processActionResult(actionResult, wrapper);
    if (wrapper.state !== YIELD) {
      wrapper.currentAi = ai;
      return wrapper;
    }
    ai = ai.next;
  }
}

function augmentativeIterateArray(augmentList, base, offset) {
  const length = base.length;
  const sub = getStack();
  let i = -1 + offset;

  return {
    next: () => {
      let keepGoing;
      do {
        keepGoing = false;
        while (sub.hasSomething()) {
          const result = sub.last().value.next();
          if (result.done) {
            sub.pop();
          } else {
            return result;
          }
        }
        iterator:
        while (++i < length) {
          const wrapper = { result: base[i] };
          resolveState(augmentList, wrapper);
          switch (wrapper.state) {
            case STOP:
              return end;
            case FLAT:
              sub.push(augmentativeIterate.call(wrapper.result, wrapper.currentAi.next));
              keepGoing = true;
              break iterator;
            case YIELD:
              return {
                done: false,
                value: wrapper.result,
              };
          };
        }
      } while (keepGoing);

      return end;
    },
  };
}

function augmentativeIterateIterable(augmentList, base, offset) {
  const sub = getStack();
  const it = base[Symbol.iterator]();

  return {
    next: () => {
      let keepGoing;
      do {
        keepGoing = false;
        if (offset > 0) {
          offset--;
          keepGoing = !it.next().done;
        } else {
          while (sub.hasSomething()) {
            const result = sub.last().value.next();
            if (result.done) {
              sub.pop();
            } else {
              return result;
            }
          }
          let next = it.next();
          iterator:
          while (!next.done) {
            const wrapper = { result: next.value };
            resolveState(augmentList, wrapper);
            switch (wrapper.state) {
              case STOP:
                return end;
              case FLAT:
                sub.push(augmentativeIterate.call(wrapper.result, wrapper.currentAi.next));
                keepGoing = true;
                break iterator;
              case YIELD:
                return {
                  done: false,
                  value: wrapper.result,
                };
            };
            next = it.next();
          }
        }
      } while (keepGoing);

      return end;
    },
    error: it.error?.bind(it),
    return: it.return?.bind(it),
  };
}

function augmentativeIterate(next) {
  const { augmentList, base, offset } = getIterableParameters(this, next, Symbol.iterator, augmentativeIterate);

  if (Array.isArray(base)) {
    return augmentativeIterateArray(augmentList, base, offset);
  }

  return augmentativeIterateIterable(augmentList, base, offset);
}

function augmentativeForEach(
  action,
) {
  const it = augmentativeIterate.call(this);
  let next;
  while (!(next = it.next()).done) {
    action(next.value);
  }
  if (it.return) {
    it.return();
  }
}

function augmentativeToArray() {
  const result = [];

  augmentativeForEach.call(this, result.push.bind(result));

  return result;
}

const filterIterable = getAugmentIterable(
  Symbol.iterator,
  augmentativeIterate,
  IGNORE,
);

const mapIterable = getAugmentIterable(
  Symbol.iterator,
  augmentativeIterate,
  YIELD,
);

const takeWhileIterable = getAugmentIterable(
  Symbol.iterator,
  augmentativeIterate,
  STOP,
);

const flatMapIterable = getAugmentIterable(
  Symbol.iterator,
  augmentativeIterate,
  FLAT,
);

const skipIterable = getSkippedAugmentIterable(
  Symbol.iterator,
  augmentativeIterate,
);

const addFilter = getAugmentIterable(Symbol.iterator, augmentativeIterate, IGNORE);
const addMap = getAugmentIterable(Symbol.iterator, augmentativeIterate, YIELD);
const addTakeWhile = getAugmentIterable(Symbol.iterator, augmentativeIterate, STOP);

module.exports = {
  addFilter,
  addMap,
  addTakeWhile,
  augmentativeIterate,
  augmentativeForEach,
  augmentativeToArray,
  filterIterable,
  mapIterable,
  takeWhileIterable,
  flatMapIterable,
  skipIterable,
};
