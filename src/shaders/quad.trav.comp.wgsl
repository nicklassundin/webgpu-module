
struct Uniforms {
	resolution: vec2<f32>,
	mipLevel: f32,
};
@group(0) @binding(0) var<uniform> uniforms: Uniforms; 


struct Node {
	valueAddress: f32,
	offset: f32,
	size: f32,
	children: vec4<f32>,	
	quad: f32,
};

struct Traversal {
	depth: vec4<f32>,
	boundBox: vec4<f32>,
	coord: vec4<f32>,
	address: f32,
};


// function to get quad index from cordinates and boundbox
fn getQuadIndex(coord: vec2<f32>, boundBox: vec4<f32>) -> f32 {
	let center = (boundBox.xy + boundBox.zw) * 0.5;
	var quad = vec2<f32>(0.0, 0.0);
	if (coord.x > center.x) {
	 	quad.x = 1.0;
	}
	if (coord.y > center.y) {
		quad.y = 1.0;
	}
	return quad.x + quad.y * 2.0;
}

@group(1) @binding(0) var<storage, read_write> traversal: Traversal;
@group(1) @binding(1) var<storage, read_write> values: array<f32>;
@group(1) @binding(2) var<storage, read_write> nodes: array<Node>;

@group(1) @binding(3) var<storage, read_write> result: array<f32>;

@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
	if traversal.boundBox.z == 0.0  {
		traversal.boundBox = vec4<f32>(0.0, 0.0, 1.0, 1.0);
	}
	let depth = traversal.depth.x;
	
	let traversalNode = traversal.address;
	let node: Node = nodes[u32(traversalNode)];
	let value = values[u32(node.valueAddress)];

	let id = global_id.x;
	//result[id] = f32(id);
	//result[u32(depth)] = value;
	//result[id] = f32(id);
	result[0] = 42.0;
	
	let coord = traversal.coord.xy;
	let quad = getQuadIndex(coord, traversal.boundBox);
	for (var i: u32 = 0; i < 4; i = i + 1) {
		let child = node.children[i];
		if (child == 0.0) {
			continue;
		}
		let childNode = nodes[u32(child)];
		if childNode.quad == quad {
			if quad == 0 {
				traversal.boundBox = vec4<f32>(traversal.boundBox.xy, (traversal.boundBox.xy + traversal.boundBox.zw) * 0.5);
			} else if quad == 1 {
				traversal.boundBox = vec4<f32>((traversal.boundBox.xy + traversal.boundBox.zw) * 0.5, traversal.boundBox.zw);
			} else if quad == 2 {
				traversal.boundBox = vec4<f32>(vec2<f32>(traversal.boundBox.x, (traversal.boundBox.y + traversal.boundBox.w) * 0.5), vec2<f32>((traversal.boundBox.x + traversal.boundBox.z) * 0.5, traversal.boundBox.w));
			} else if quad == 3 {
				traversal.boundBox = vec4<f32>(vec2<f32>((traversal.boundBox.x + traversal.boundBox.z) * 0.5, (traversal.boundBox.y + traversal.boundBox.w) * 0.5), traversal.boundBox.zw);
			}
		}
		
	}
}
