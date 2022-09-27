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

  // setup GLSL program
  var programInfo = twgl.createProgramInfo(gl, [vs, fs]);

  function degToRad(d) {
    return d * Math.PI / 180;
  }

  var fieldOfViewRadians = degToRad(60);

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

  
  function createObject() {
  
    var trs  = new TRS();
    var node = new Node(trs);

    var node_name = name_input.value;

    node.name = node_name;
    node.draw = true;

    nodeInfosByName[node.name] = {
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
    };

    objectsToDraw.push(node.drawInfo);
    objects.push(node);
    /* } */
  }

  requestAnimationFrame(drawScene);

  // Draw the scene.
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