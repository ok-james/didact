/**
 * 根据自己的记忆、思路以及想法，在不参考 didact.js 的前提下，自己写一遍，一定不要参考，有问题，自己 debug 解决
 */

function createElement(type, props, ...children) {
  return {
    type,
    props: {
      ...(props || {}),
      children: children.map((child) => typeof child === "object" ? child : createTextChild(child)),
    },
  }
}

const TEXT_CHILD_TYPE = "TEXT_TYPE"

function createTextChild(text) {
  return {
    type: TEXT_CHILD_TYPE,
    props: {
      textContent: text,
      children: [],
    },
  }
}

function createDOM(fiber) {
  const element = fiber.type === TEXT_CHILD_TYPE ? document.createTextNode("") : document.createElement(fiber.type)
  
  handleProps(element, null, fiber.props)
  
  return element
}

function isProperty(key) {
  return key !== "children" && !isEvent(key)
}

function isEvent(key) {
  return key.startsWith("on")
}

function isNew(currProps, preProps) {
  return (key) => {
    return currProps[key] !== preProps[key]
  }
}

function handleProps(element, preProps, currProps) {
  preProps = preProps || {}
  currProps = currProps || {}
  
  // 添加属性
  Object.keys(currProps).filter(isProperty).filter(isNew(currProps, preProps)).forEach((key) => {
    element[key] = currProps[key]
  })
  
  // 删除属性
  Object.keys(preProps).filter((key) => isProperty(key) && (currProps[key] === null || currProps[key] === undefined)).forEach(key => {
    element[key] = ""
  })
  
  // 添加事件
  Object.keys(currProps).filter(isEvent).filter(isNew(currProps, preProps)).forEach((key) => {
    let eventName = key.slice(2)
    eventName = eventName.toLowerCase()
    element.addEventListener(eventName, currProps[key])
  })
  
  // 删除事件
  Object.keys(preProps).filter((key) => isEvent(key) && !currProps[key]).forEach(key => {
    let eventName = key.slice(2)
    eventName = eventName.toLowerCase()
    element.removeEventListener(eventName, preProps[key])
  })
}

// 下一次要处理的 Fiber
let nextWorkFiber = null
// 当前正在处理的 Fiber 树的根节点的引用
let wipRoot = null
let currentWipRoot = null
// 要删除的 fiber
let removeFibers = null

function render(root, container) {
  wipRoot = {
    props: {
      children: [root],
    },
    dom: container,
    alternate: currentWipRoot,
  }
  removeFibers = []
  nextWorkFiber = wipRoot
}

// 调度
function workLoop(deadline) {
  let shouldYield = false
  
  while (nextWorkFiber && !shouldYield) {
    nextWorkFiber = handleFiber(nextWorkFiber)
    shouldYield = deadline.timeRemaining() < 1
  }
  
  // wipRoot：当前确实在处理 Fiber
  // && !nextWorkFiber：并且 Fiber 已经处理完成
  if (wipRoot && !nextWorkFiber) {
    // 此时才会真正将创建的 DOM 插入文档树中
    commitRoot()
  }
  
  requestIdleCallback(workLoop)
}

requestIdleCallback(workLoop)

let currentHookFiber = null
let currentHookIndex = 0

function handleFunctionalFiber(fiber) {
  currentHookFiber = fiber
  currentHookFiber.hooks = []
  currentHookIndex = 0
  fiber.props.children = [fiber.type(fiber.props)]
}

function useState(initial) {
  const preHooks = currentHookFiber.alternate && currentHookFiber.alternate.hooks || []
  const preHook = preHooks[currentHookIndex]
  const hook = {
    state: preHook ? preHook.state : initial,
    actions: [],
  }
  
  function setState(action) {
    hook.state = action(hook.state)
    wipRoot = {
      props: currentWipRoot.props,
      dom: currentWipRoot.dom,
      alternate: currentWipRoot,
    }
    nextWorkFiber = wipRoot
    removeFibers = []
  }
  
  currentHookFiber.hooks[currentHookIndex] = hook
  currentHookIndex++
  
  return [hook.state, setState]
}

function handleFiber(fiber) {
  if (typeof fiber.type === "function") {
    handleFunctionalFiber(fiber)
  } else if (!fiber.dom) {
    fiber.dom = createDOM(fiber)
  }
  
  diffFiber(fiber, fiber.props.children)
  
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

function diffFiber(parentFiber, children) {
  let index = 0
  let fiber = null
  let prevFiber = null
  let oldChildFiber = parentFiber.alternate && parentFiber.alternate.child
  
  while (index < children.length || oldChildFiber) {
    let child = children[index]
    const isSameType = child && oldChildFiber && child.type === oldChildFiber.type
    
    if (isSameType) {
      fiber = {
        dom: oldChildFiber.dom,
        type: oldChildFiber.type,
        props: child.props,
        parent: parentFiber,
        alternate: oldChildFiber,
        effectTag: "UPDATE",
      }
    }
    
    if (child && !isSameType) {
      fiber = {
        type: child.type,
        props: child.props,
        parent: parentFiber,
        effectTag: "CREATE",
      }
    }
    
    if (oldChildFiber && !isSameType) {
      oldChildFiber.effectTag = "REMOVE"
      removeFibers.push(oldChildFiber)
    }
    
    if (index === 0) {
      parentFiber.child = fiber
    } else if (child) {
      prevFiber.sibling = fiber
    }
    
    prevFiber = fiber
    oldChildFiber = oldChildFiber && oldChildFiber.sibling
    index++
  }
}

function commitRoot() {
  removeFibers.forEach(commitDOM)
  commitDOM(wipRoot.child)
  currentWipRoot = wipRoot
  wipRoot = null
}

function commitDOM(fiber) {
  if (!fiber) {
    return
  }
  let parent = fiber.parent
  let parentDOM = parent.dom
  
  while (!parentDOM) {
    parent = parent.parent
    parentDOM = parent.dom
  }
  
  if (fiber.effectTag === "UPDATE" && fiber.dom !== null) {
    handleProps(fiber.dom, fiber.alternate && fiber.alternate.props, fiber.props)
  } else if (fiber.effectTag === "CREATE" && fiber.dom !== null) {
    parentDOM.appendChild(fiber.dom)
  } else if (fiber.effectTag === "REMOVE") {
    removeDOM(parentDOM, fiber)
  }
  
  commitDOM(fiber.child)
  commitDOM(fiber.sibling)
}

function removeDOM(parentDOM, fiber) {
  let childDOM = fiber.dom
  
  while (!childDOM) {
    fiber = fiber.child
    childDOM = fiber.dom
  }
  
  parentDOM.removeChild(childDOM)
}

const Baby = {
  createElement,
  useState,
  render,
}

function App() {
  const [count, setCount] = Baby.useState(0)
  const [color, setColor] = Baby.useState("red")
  return (
    <div>
      <h1 style={`color:${color};`}>{count}</h1>
      <button onClick={() => {
        setCount((pre) => pre + 1)
      }}>
        add
      </button>
      <button onClick={() => {
        setColor((pre) => pre === "red" ? "blue" : "red")
      }}>color
      </button>
    </div>
  )
}

/** @jsx Baby.createElement */
const rootElement = (
  <App />
)

let rootDOM = document.querySelector("#baby")
Baby.render(rootElement, rootDOM)