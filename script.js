"use strict";

var vs = `#version 300 es

in vec4 a_position;
in vec4 a_color;

uniform mat4 u_matrix;

out vec4 v_color;

void main() {
  // Multiply the position by the matrix.
  gl_Position = u_matrix * a_position;

  // Pass the color to the fragment shader.
  v_color = a_color;
}
`;

var fs = `#version 300 es
precision highp float;

// Passed in from the vertex shader.
in vec4 v_color;

uniform vec4 u_colorMult;
uniform vec4 u_colorOffset;

out vec4 outColor;

void main() {
   outColor = v_color * u_colorMult + u_colorOffset;
}
`;

var TRS = function() {
  this.translation = [0, 0, 0];
  this.rotation = [0, 0, 0];
  this.scale = [1, 1, 1];
};

TRS.prototype.getMatrix = function(dst) {
  dst = dst || new Float32Array(16);
  var t = this.translation;
  var r = this.rotation;
  var s = this.scale;

  // compute a matrix from translation, rotation, and scale
  m4.translation(t[0], t[1], t[2], dst);
  m4.xRotate(dst, r[0], dst);
  m4.yRotate(dst, r[1], dst);
  m4.zRotate(dst, r[2], dst);
  m4.scale(dst, s[0], s[1], s[2], dst);
  return dst;
};

var Node = function(source) {
  this.children = [];
  this.localMatrix = m4.identity();
  this.worldMatrix = m4.identity();
  this.source = source;
};

Node.prototype.setParent = function(parent) {
  // remove us from our parent
  if (this.parent) {
    var ndx = this.parent.children.indexOf(this);
    if (ndx >= 0) {
      this.parent.children.splice(ndx, 1);
    }
  }

  // Add us to our new parent
  if (parent) {
    parent.children.push(this);
  }
  this.parent = parent;
};

Node.prototype.updateWorldMatrix = function(matrix) {

  var source = this.source;
  if (source) {
    source.getMatrix(this.localMatrix);
  }

  if (matrix) {
    // a matrix was passed in so do the math
    m4.multiply(matrix, this.localMatrix, this.worldMatrix);
  } else {
    // no matrix was passed in so just copy.
    m4.copy(this.localMatrix, this.worldMatrix);
  }

  // now process all the children
  var worldMatrix = this.worldMatrix;
  this.children.forEach(function(child) {
    child.updateWorldMatrix(worldMatrix);
  });
};

function main() {
  // Get A WebGL context
  /** @type {HTMLCanvasElement} */
  var canvas = document.querySelector("#canvas");
  var gl = canvas.getContext("webgl2");
  if (!gl) { return; }
  const gui = new dat.GUI();

  // Tell the twgl to match position with a_position, n
  // normal with a_normal etc..
  twgl.setAttributePrefix("a_");

  var cubeBufferInfo = flattenedPrimitives.createCubeBufferInfo(gl, 1);
  var sphereBufferInfo = flattenedPrimitives.createSphereBufferInfo(gl, 1, 10, 10); // 
  var coneBufferInfo   = flattenedPrimitives.createTruncatedConeBufferInfo(gl, 2, 0, 2, 3, 3, true, false);
  var bufferArray = [cubeBufferInfo, sphereBufferInfo, coneBufferInfo];

  // setup GLSL program
  var programInfo = twgl.createProgramInfo(gl, [vs, fs]);

  var cubeVAO   = twgl.createVAOFromBufferInfo(gl, programInfo, cubeBufferInfo);
  var sphereVAO = twgl.createVAOFromBufferInfo(gl, programInfo, sphereBufferInfo);
  var coneVAO   = twgl.createVAOFromBufferInfo(gl, programInfo, coneBufferInfo);
  var VAOArray = [cubeVAO, sphereVAO, coneVAO];

  function degToRad(d) {
    return d * Math.PI / 180;
  }

  var fieldOfViewRadians = degToRad(60);

  var objectsToDraw = [];
  var objects = [];
  var nodeInfosByName = {};

  // Let's make all the nodes
  // var blockGuyNodeDescriptions

/*   function makeNode(nodeDescription) {
    var trs  = new TRS();
    var node = new Node(trs);
    nodeInfosByName[nodeDescription.name] = {
      trs: trs,
      node: node,
    };
    trs.translation = nodeDescription.translation || trs.translation;
    if (nodeDescription.draw !== false) {
      node.drawInfo = {
        uniforms: {
          u_colorOffset: [0, 0, 0.6, 0],
          u_colorMult: [0.4, 0.4, 0.4, 1],
        },
        programInfo: programInfo,
        bufferInfo: nodeDescription.bufferInfo,
        vertexArray: nodeDescription.nodeVAO,
      };
      objectsToDraw.push(node.drawInfo);
      objects.push(node);
    }
    makeNodes(nodeDescription.children).forEach(function(child) {
      child.setParent(node);
    });
    return node;
  }

  function makeNodes(nodeDescriptions) {
    return nodeDescriptions ? nodeDescriptions.map(makeNode) : [];
  } */

  /* var base_element = {
    name: "base",
    draw: false,
    children: []
  }; */
  
  /* var scene = makeNode(base_element); */
  var objectList = document.getElementById("existing-objects");
  function selectElement(e) {
    var selected = document.querySelector(".selected");
    if(selected) {
      selected.classList.remove("selected");
      gui.remove(x);
      gui.remove(y);
      gui.remove(z);
    }
    e.target.classList.add("selected");
    var selected_id = parseInt(e.target.getAttribute("id"));
    var selected_name = e.target.innerHTML;

    var state = {
      x: 0,
      y: 0,
      z: 0,
    }

    var x = gui.add(state, "x", 0, 100).onChange((value) => {
      nodeInfosByName[selected_name].trs.translation[0] = value;
    });
    var y = gui.add(state, "y", 0, 100).onChange((value) => {
      nodeInfosByName[selected_name].trs.translation[1] = value;
      console.log(objects);
      console.log(objectsToDraw);
    });
    var z = gui.add(state, "z", 0, 100).onChange((value) => {
      nodeInfosByName[selected_name].trs.translation[2] = value;
    });

  }

  var id = 0;
  function createObject() {
    var name_input = document.getElementById("name");
    var shape_index = document.querySelector("input[name='shape']:checked");
    shape_index = parseInt(shape_index.value);

    var trs  = new TRS();
    var node = new Node(trs);

    if(name_input.value) {
      console.log("true");
    }
    node.name = name_input.value || "undefined";
    node.draw = true;
    node.id = id;
    id += 1;

    nodeInfosByName[name_input.value] = {
      trs: trs,
      node: node,
    };

    /* if (nodeDescription.draw !== false) { */
    node.drawInfo = {
      uniforms: {
        u_colorOffset: [0, 0, 0.6, 0],
        u_colorMult: [0.4, 0.4, 0.4, 1],
      },
      programInfo: programInfo,
      bufferInfo: bufferArray[shape_index],
      vertexArray: VAOArray[shape_index]
    };

    objectsToDraw.push(node.drawInfo);
    objects.push(node);
    /* } */

    /*base_element.children.push(nodeDescription);

    scene = makeNode(base_element); */

    
    var listElement = document.createElement("p");
    listElement.innerHTML = name_input.value;
    listElement.classList.add("list-element");
    listElement.setAttribute("id", node.id);
    listElement.onclick = selectElement;
    objectList.appendChild(listElement);

    name_input.value = "";
  }

  var button = document.getElementById("create-button");
  button.onclick = createObject;

  requestAnimationFrame(drawScene);

  // Draw the scene.
  function drawScene(time) {
    time *= 0.001;

    twgl.resizeCanvasToDisplaySize(gl.canvas);

    // Tell WebGL how to convert from clip space to pixels
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);

    // Compute the projection matrix
    var aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    var projectionMatrix =
        m4.perspective(fieldOfViewRadians, aspect, 1, 200);

    // Compute the camera's matrix using look at.
    var cameraPosition = [4, 3.5, 10];
    var target = [0, 3.5, 0];
    var up = [0, 1, 0];
    var cameraMatrix = m4.lookAt(cameraPosition, target, up);

    // Make a view matrix from the camera matrix.
    var viewMatrix = m4.inverse(cameraMatrix);

    var viewProjectionMatrix = m4.multiply(projectionMatrix, viewMatrix);

    // Update all world matrices in the scene graph
    //scene.updateWorldMatrix();

    // Compute all the matrices for rendering
    objects.forEach(function(object) {
        object.updateWorldMatrix();
        object.drawInfo.uniforms.u_matrix = m4.multiply(viewProjectionMatrix, object.worldMatrix);
    });

    // ------ Draw the objects --------

    twgl.drawObjectList(gl, objectsToDraw);

    requestAnimationFrame(drawScene);
  }
}

document.addEventListener('load', main());