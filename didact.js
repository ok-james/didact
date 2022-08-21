function createElement(type, props, ...children) {
  return {
    type,
    props: {
      ...props,
      children: children.map(child =>
        typeof child === "object"
          ? child
          : createTextElement(child),
      ),
    },
  }
}

function createTextElement(text) {
  return {
    type: "TEXT_ELEMENT",
    props: {
      nodeValue: text,
      children: [],
    },
  }
}

function createDom(fiber) {
  const dom =
    fiber.type === "TEXT_ELEMENT"
      ? document.createTextNode("")
      : document.createElement(fiber.type)
  
  updateDom(dom, {}, fiber.props)
  
  return dom
}

const isEvent = key => key.startsWith("on")
const isProperty = key =>
  key !== "children" && !isEvent(key)
const isNew = (prev, next) => key =>
  prev[key] !== next[key]
const isGone = (prev, next) => key => !(key in next)

function updateDom(dom, prevProps, nextProps) {
  //Remove old or changed event listeners
  Object.keys(prevProps)
  .filter(isEvent)
  .filter(
    key =>
      !(key in nextProps) ||
      isNew(prevProps, nextProps)(key),
  )
  .forEach(name => {
    const eventType = name
    .toLowerCase()
    .substring(2)
    dom.removeEventListener(
      eventType,
      prevProps[name],
    )
  })
  
  // Remove old properties
  Object.keys(prevProps)
  .filter(isProperty)
  .filter(isGone(prevProps, nextProps))
  .forEach(name => {
    dom[name] = ""
  })
  
  // Set new or changed properties
  Object.keys(nextProps)
  .filter(isProperty)
  .filter(isNew(prevProps, nextProps))
  .forEach(name => {
    dom[name] = nextProps[name]
  })
  
  // Add event listeners
  Object.keys(nextProps)
  .filter(isEvent)
  .filter(isNew(prevProps, nextProps))
  .forEach(name => {
    const eventType = name
    .toLowerCase()
    .substring(2)
    dom.addEventListener(
      eventType,
      nextProps[name],
    )
  })
}

function commitRoot() {
  deletions.forEach(commitWork)
  commitWork(wipRoot.child)
  currentRoot = wipRoot
  wipRoot = null
}

function commitWork(fiber) {
  if (!fiber) {
    return
  }
  
  let domParentFiber = fiber.parent
  while (!domParentFiber.dom) {
    domParentFiber = domParentFiber.parent
  }
  const domParent = domParentFiber.dom
  
  if (
    fiber.effectTag === "PLACEMENT" &&
    fiber.dom != null
  ) {
    domParent.appendChild(fiber.dom)
  } else if (
    fiber.effectTag === "UPDATE" &&
    fiber.dom != null
  ) {
    updateDom(
      fiber.dom,
      fiber.alternate.props,
      fiber.props,
    )
  } else if (fiber.effectTag === "DELETION") {
    commitDeletion(fiber, domParent)
  }
  
  commitWork(fiber.child)
  commitWork(fiber.sibling)
}

function commitDeletion(fiber, domParent) {
  if (fiber.dom) {
    domParent.removeChild(fiber.dom)
  } else {
    commitDeletion(fiber.child, domParent)
  }
}

function render(element, container) {
  wipRoot = {
    dom: container,
    props: {
      children: [element],
    },
    alternate: currentRoot,
  }
  deletions = []
  // 初始化第一次处理的 Fiber 树的根节点，真正的处理流程是在 workLoop 循环中
  nextUnitOfWork = wipRoot
}

// 下一次将要处理的 Fiber
let nextUnitOfWork = null
// 上次提交到 DOM 节点的 fiber 树的根节点的引用
let currentRoot = null
// 整颗 Fiber 树的根节点的引用
let wipRoot = null
// 一次完整的渲染中要删除的 Fiber 的数组
let deletions = null

function workLoop(deadline) {
  let shouldYield = false
  
  // 存在可以待处理的 Fiber 并且还有剩余的空闲时间
  while (nextUnitOfWork && !shouldYield) {
    nextUnitOfWork = performUnitOfWork(
      nextUnitOfWork,
    )
    
    // deadline.timeRemaining() 方法每次调用就会返回最新剩余的空闲时间，
    // 也就是说，返回值会实时更新，如果没有时间了，则总会返回 0
    shouldYield = deadline.timeRemaining() < 1
  }
  
  // 这两个条件的含义是：
  // wipRoot：存在正在处理的 Fiber 树
  // !nextUnitOfWork：并且 Fiber 树已经处理完成了
  if (!nextUnitOfWork && wipRoot) {
    commitRoot()
  }
  
  requestIdleCallback(workLoop)
}

// 这里运行 workLoop 以后，由于 workLoop 内部也有一个 requestIdleCallback 函数的调用，
// 所以这其实就是 workLoop 的无限循环的调用，当然，是在浏览器空闲的时候调用
requestIdleCallback(workLoop)

function performUnitOfWork(fiber) {
  // 如果 fiber.type 是函数，说明当前 fiber 是函数式组件
  const isFunctionComponent =
    fiber.type instanceof Function
  if (isFunctionComponent) {
    updateFunctionComponent(fiber)
  } else {
    updateHostComponent(fiber)
  }
  if (fiber.child) {
    return fiber.child
  }
  let nextFiber = fiber
  while (nextFiber) {
    if (nextFiber.sibling) {
      return nextFiber.sibling
    }
    nextFiber = nextFiber.parent
  }
}

// 当 Fiber 是函数式组件时，指向正在处理的函数式组件的 Fiber 实例的引用
let wipFiber = null
// 正在处理的函数式组件的中 hooks 的索引
let hookIndex = null

function updateFunctionComponent(fiber) {
  wipFiber = fiber
  hookIndex = 0
  wipFiber.hooks = []
  const children = [fiber.type(fiber.props)]
  reconcileChildren(fiber, children)
}

function useState(initial) {
  // 每一次都是在处理 hookIndex 指向的那一个 hook ，这就是为什么在函数式组件中不能对 hook 使用 if 和 for 等语句的原因，
  // 如果使用的话，计数会失效
  const oldHook =
    wipFiber.alternate &&
    wipFiber.alternate.hooks &&
    wipFiber.alternate.hooks[hookIndex]
  const hook = {
    state: oldHook ? oldHook.state : initial,
    queue: [],
  }
  
  const actions = oldHook ? oldHook.queue : []
  actions.forEach(action => {
    hook.state = action(hook.state)
  })
  
  const setState = action => {
    // 一旦调用 setState 以后，将 action 放入 hook.queue 中，
    // 下一次渲染时，这里的 hook 就变成了上面的 oldHook ，所以前面的代码中，
    // 从 oldHook 中取出 queue 数组执行并更新 hook.state
    hook.queue.push(action)
    wipRoot = {
      dom: currentRoot.dom,
      props: currentRoot.props,
      alternate: currentRoot,
    }
    nextUnitOfWork = wipRoot
    deletions = []
  }
  
  // 每次组件更新，都会创建一组新的 hooks 对象
  wipFiber.hooks.push(hook)
  hookIndex++
  return [hook.state, setState]
}

function updateHostComponent(fiber) {
  if (!fiber.dom) {
    fiber.dom = createDom(fiber)
  }
  reconcileChildren(fiber, fiber.props.children)
}

/**
 * 处理 wipFiber 下的所有子元素，依次创建 Fiber 同时 diff
 * @param wipFiber
 * @param elements
 */
function reconcileChildren(wipFiber, elements) {
  let index = 0
  // 前一次渲染树中 wipFiber 的第一个子 Fiber
  let oldFiber =
    wipFiber.alternate && wipFiber.alternate.child
  let prevSibling = null
  
  while (
    index < elements.length ||
    oldFiber != null
    ) {
    const element = elements[index]
    let newFiber = null
    
    const sameType =
      oldFiber &&
      element &&
      element.type === oldFiber.type
    
    if (sameType) {
      newFiber = {
        type: oldFiber.type,
        // DOM 元素重用，但是 props 可能有修改，所以要用 element.props
        props: element.props,
        dom: oldFiber.dom,
        parent: wipFiber,
        alternate: oldFiber,
        effectTag: "UPDATE",
      }
    }
    if (element && !sameType) {
      newFiber = {
        type: element.type,
        props: element.props,
        dom: null,
        parent: wipFiber,
        alternate: null,
        effectTag: "PLACEMENT",
      }
    }
    if (oldFiber && !sameType) {
      oldFiber.effectTag = "DELETION"
      deletions.push(oldFiber)
    }
    
    if (oldFiber) {
      oldFiber = oldFiber.sibling
    }
    
    // 如果是第一个子元素，则父元素直接指向该子元素
    if (index === 0) {
      wipFiber.child = newFiber
    } else if (element) {
      // 如果不是第一个子元素，则使用前一个子元素指向当前子元素
      prevSibling.sibling = newFiber
    }
    
    prevSibling = newFiber
    index++
  }
}

const Didact = {
  createElement,
  render,
  useState,
}

/** @jsx Didact.createElement */
function Counter() {
  const [state, setState] = Didact.useState(1)
  return (
    <h1 onClick={() => setState(c => c + 1)}>
      Count: {state}
    </h1>
  )
}

const element = <Counter />
const container = document.getElementById("root")
Didact.render(element, container)
