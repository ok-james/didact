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
  
  handleProps(element, fiber.props)
  
  return element
}

function isProperty(key) {
  return key !== "children"
}

// Todo 可能还需要考虑事件的处理
function handleProps(element, props) {
  Object.keys(props).filter(isProperty).forEach((key) => {
    element[key] = props[key]
  })
}

// 下一次要处理的 Fiber
let nextWorkFiber = null
// 当前正在处理的 Fiber 树的根节点的引用
let wipRoot = null

function render(root, container) {
  wipRoot = {
    type: root.type,
    props: root.props,
    dom: container,
  }
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

function handleFiber(fiber) {
  if (!fiber.dom) {
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

// Todo 实际上，还没实现 diff 的功能
function diffFiber(parentFiber, children) {
  let index = 0
  let fiber = null
  let prevFiber = null
  
  while (children.length < index) {
    let child = children[index]
    
    fiber = {
      type: child.type,
      props: child.props,
      parent: parentFiber,
    }
    
    if (index === 0) {
      parentFiber.child = fiber
    } else {
      prevFiber.sibling = fiber
    }
    
    prevFiber = fiber
    index++
  }
}

function commitRoot() {

}

const Baby = {
  createElement,
  render,
}

/** @jsx Baby.createElement */
const rootElement = (
  <div>
    <h1>hello</h1>
    <p>world</p>
  </div>
)

let rootDOM = document.querySelector("root")
Baby.render(rootElement, rootDOM)