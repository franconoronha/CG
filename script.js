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

function degToRad(d) {
  return d * Math.PI / 180;
}

function main() {
  // Get A WebGL context
  /** @type {HTMLCanvasElement} */
  var canvas = document.querySelector("#canvas");
  var gl = canvas.getContext("webgl2");
  if (!gl) { return; }
  const gui = new dat.GUI();

  // Tell the twgl to match position with a_position, normal with a_normal etc..
  twgl.setAttributePrefix("a_");
 
  var modelInfo = {
    position: {
      numComponents: 3,
      data: [-1, -1, -1, 1, -1, -1, 1, 1, -1, -1, 1, -1, -1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1, 1]
    },
    indices: {
      numComponents: 3,
      data: [0, 1, 3, 3, 1, 2, 1, 5, 2, 2, 5, 6, 5, 4, 6, 6, 4, 7, 4, 0, 7, 7, 0, 3, 3, 2, 7, 7, 2, 6, 4, 5, 0, 0, 5, 1]
    },
    normals: {
      numComponents: 3,
      data: [0, 0, 1, 1, 0, 0, 0, 0, -1, -1, 0, 0, 0, 1, 0, 0, -1, 0]
    }
  };

  // setup GLSL program
  var programInfo = twgl.createProgramInfo(gl, [vs, fs]);
  var modelBufferInfo = twgl.createBufferInfoFromArrays(gl, modelInfo);
  var basic_VAO = twgl.createVAOFromBufferInfo(gl, programInfo, modelBufferInfo);

  var objectsToDraw = [];
  var objects = [];
  var nodeInfosByName = {};

  var state = {};
  
  var cameraPosition = [4, 3.5, 10];
  state.camera_x = cameraPosition[0];
  state.camera_y = cameraPosition[1];
  state.camera_z = cameraPosition[2];

  var target = [0, 3.5, 0];
  state.target_x = target[0];
  state.target_y = target[1];
  state.target_z = target[2];

  var guiCamera = gui.addFolder("Camera");
  guiCamera.add(state, "camera_x", 0, 50).onChange(value => {
    cameraPosition[0] = value;
  });
  guiCamera.add(state, "camera_y", 0, 50).onChange(value => {
    cameraPosition[1] = value;
  });
  guiCamera.add(state, "camera_z", 0, 50).onChange(value => {
    cameraPosition[2] = value;
  });

  var guiTarget = gui.addFolder("Target");
  guiTarget.add(state, "target_x", 0, 50).onChange(value => {
    target[0] = value;
  });
  guiTarget.add(state, "target_y", 0, 50).onChange(value => {
    target[1] = value;
  });
  guiTarget.add(state, "target_z", 0, 50).onChange(value => {
    target[2] = value;
  });

  var deg = 60;
  var fieldOfViewRadians = degToRad(deg);
  var cameraPosition = [10, 5, 10];
  var target = [0, 0, 0];
  var up = [0, 1, 0];

  document.onwheel = function(e) {
    var move = e.deltaY / 25;
    deg += move;
    fieldOfViewRadians = degToRad(deg);
  };

  var dragging = false;
  var dX, dY, old_x, old_y;

  canvas.onmousedown = (e) => {
    old_x = e.pageX, old_y = e.pageY;
    dragging = true;
  };

  canvas.onmouseup = () => {dragging = false};
  document.onmousemove = function(e) {
    if(!dragging) return;
    dX = (e.pageX - old_x) * 2 * Math.PI / gl.canvas.width;
    dY = (e.pageY - old_y) * 2 * Math.PI / gl.canvas.height;
    scene.source.rotation[0] += dY;
    scene.source.rotation[1] += dX;
    old_x = e.pageX, old_y = e.pageY;

  };

  var objectList = document.getElementById("existing-objects");
  var gui_x, gui_y, gui_z, gui_rotate_x, gui_rotate_y, gui_rotate_z, gui_scale_x, gui_scale_y, gui_scale_z;
  var objFolder = gui.addFolder("Object");
  var selectedElement = {};

  function selectElement(e) {
    var selected = document.querySelector(".selected");
    if(selected) {
      selected.classList.remove("selected");
      objFolder.remove(gui_x);
      objFolder.remove(gui_y);
      objFolder.remove(gui_z);
      objFolder.remove(gui_rotate_x);
      objFolder.remove(gui_rotate_y);
      objFolder.remove(gui_rotate_z);
      objFolder.remove(gui_scale_x);
      objFolder.remove(gui_scale_y);
      objFolder.remove(gui_scale_z);
    }
    e.target.classList.add("selected");

    var selected_name = e.target.innerHTML;
    var selected_node = nodeInfosByName[selected_name];
    selectedElement = selected_node.node;

    state.x = selected_node.trs.translation[0];
    state.y = selected_node.trs.translation[1];
    state.z = selected_node.trs.translation[2];
    state.rotate_x = selected_node.trs.rotation[0];
    state.rotate_y = selected_node.trs.rotation[1];
    state.rotate_z = selected_node.trs.rotation[2];
    state.scale_x = selected_node.trs.scale[0];
    state.scale_y = selected_node.trs.scale[1];
    state.scale_z = selected_node.trs.scale[2];

    gui_x = objFolder.add(state, "x", -10, 10).onChange((value) => {
      selected_node.trs.translation[0] = value;
    });
    gui_y = objFolder.add(state, "y", -10, 10).onChange((value) => {
      selected_node.trs.translation[1] = value;
    });
    gui_z = objFolder.add(state, "z", -10, 10).onChange((value) => {
      selected_node.trs.translation[2] = value;
    });

    gui_rotate_x = objFolder.add(state, "rotate_x", -10, 10).onChange((value) => {
      selected_node.trs.rotation[0] = value;
    });
    gui_rotate_y = objFolder.add(state, "rotate_y", -10, 10).onChange((value) => {
      selected_node.trs.rotation[1] = value;
    });
    gui_rotate_z = objFolder.add(state, "rotate_z", -10, 10).onChange((value) => {
      selected_node.trs.rotation[2] = value;
    });

    gui_scale_x = objFolder.add(state, "scale_x", 1, 10).onChange(value => {
      selected_node.trs.scale[0] = value;
    });
    gui_scale_y = objFolder.add(state, "scale_y", 1, 10).onChange(value => {
      selected_node.trs.scale[1] = value;
    });
    gui_scale_z = objFolder.add(state, "scale_z", 1, 10).onChange(value => {
      selected_node.trs.scale[2] = value;
    });
  }

  var unnamedCounter = 0;
  var scene = new Node(new TRS());
  selectedElement = scene;

  function createObject() {
    var name_input = document.getElementById("name");
    var trs  = new TRS();
    var node = new Node(trs);

    var node_name = name_input.value;
    if(!name_input.value.length) {
      node_name = "unnamedObject" + unnamedCounter;
      unnamedCounter++;
    }

    node.name = node_name;
    node.draw = true;

    nodeInfosByName[node.name] = {
      trs: trs,
      node: node,
    };

    node.drawInfo = {
      uniforms: {
        u_colorOffset: [0, 0, 0.6, 0],
        u_colorMult: [0.4, 0.4, 0.4, 1],
      },
      programInfo: programInfo,
      bufferInfo: modelBufferInfo,
      vertexArray: basic_VAO
    };

    objectsToDraw.push(node.drawInfo);
    objects.push(node);
    selectedElement.children.push(node);

    var listElement = document.createElement("p");
    listElement.innerHTML = node_name;
    listElement.classList.add("list-element");
    listElement.onclick = selectElement;
    objectList.appendChild(listElement);

    name_input.value = "";
  }

  var button = document.getElementById("create-button");
  button.onclick = createObject;

  // SALVAR E CARREGAR 
  /* var inputElement = document.getElementById("modelInput");
  state.loadModel = () => {inputElement.click()};

  inputElement.onchange = function(e) {
    if(inputElement.files) {
      const reader = new FileReader();
      reader.readAsText(inputElement.files[0]);
      reader.onload = function() {
        modelInfo = JSON.parse(reader.result);
        
        // SUBSTITUIR POR FUNÇÃO DE SETUP
        modelBufferInfo = twgl.createBufferInfoFromArrays(gl, modelInfo);
        VAO = twgl.createVAOFromBufferInfo(gl, programInfo, modelBufferInfo);
      };
    }
  };

  state.saveModel = function() {
      var name = prompt("Digite o nome do arquivo");
      if(name != null) {
        var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(modelInfo));
        var dlAnchorElem = document.createElement("a");
        dlAnchorElem.setAttribute("href", dataStr);
        dlAnchorElem.setAttribute("download", name + ".json");
        dlAnchorElem.click();
      }
  };
  gui.add(state, 'loadModel').name("Carregar modelo");
  gui.add(state, 'saveModel').name("Salvar modelo"); */
  // FIM SALVAR E CARREGAR

  requestAnimationFrame(drawScene);
  function drawScene() {
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
    var cameraMatrix = m4.lookAt(cameraPosition, target, up);

    // Make a view matrix from the camera matrix.
    var viewMatrix = m4.inverse(cameraMatrix);

    var viewProjectionMatrix = m4.multiply(projectionMatrix, viewMatrix);

    // Update all world matrices in the scene graph
    scene.updateWorldMatrix();

    // Compute all the matrices for rendering
    objects.forEach(function(object) {
        object.drawInfo.uniforms.u_matrix = m4.multiply(viewProjectionMatrix, object.worldMatrix);
    });

    // ------ Draw the objects --------
    twgl.drawObjectList(gl, objectsToDraw);

    requestAnimationFrame(drawScene);
  }
}

document.addEventListener('load', main());