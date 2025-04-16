
struct Traversal {
	depth: f32,
	address: f32,
	coord: vec2<f32>,
	boundBox: vec4<f32>,
	quad: i32,
	_pad: vec3<i32>,
};

struct Vertex {
	position: vec4<f32>,
	values: vec4<f32>,
};
struct Quad {
	vertices: array<Vertex, 4>,
};

struct Indices {
	indices: array<u32, 6>,
};

struct State {
	iter: array<u32, 16>,
};


struct Uniforms {
resolution: vec2<f32>,
mipLevel: f32,
offset: u32,
};

@group(0) @binding(0) var<storage, read_write> vertices: array<Quad>;
@group(0) @binding(1) var<storage, read_write> indices: array<Indices>;
@group(0) @binding(2) var<storage, read_write> state: State;
@group(1) @binding(0) var<storage, read> levelValues: array<f32>;
@group(1) @binding(1) var<storage, read> traversal: array<Traversal>; 
@group(1) @binding(2) var<uniform> uniforms: Uniforms; 

fn getNodeIndex(level: f32, pos: f32) -> u32 {
	return u32((pow(4, level + 1) - 1) / 3 + pos);
}
fn modf(a: f32, b: f32) -> f32 {
    return a - b * floor(a / b);
}
fn getNodeCoord(level: f32, pos: f32) -> vec2<f32> {
	let grid = pow(2.0, level);
	let x = modf(pos, grid);
	let y = floor(pos / grid);
	return vec2<f32>(x, y);
}

@compute @workgroup_size(2,2,2)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>,
@builtin(local_invocation_id) local_id: vec3<u32>) {
	//let z = global_id.z;
	let z = local_id.z;
	let index = z + state.iter[z]/2;
	//let index = z;
	let edge = local_id.x + local_id.y * 2;
	let level: u32 = u32(traversal[index].depth);
	let grid: f32 = pow(2.0, f32(level));
	

	

	
	//var coord = traversal[0].coord;
	var coord = traversal[index].coord;

	let pixCoord = coord*grid;
	
	let p_x = u32(pixCoord.x);
	let p_y = u32(pixCoord.y);

	var x = f32(p_x+local_id.x) / grid;
	var y = f32(p_y+local_id.y) / grid;

	let vIndex = (local_id.x + local_id.y * 2) + index*2*2;
	/*
	let quad = traversal[index].quad;
	let vIndex = getNodeIndex(uniforms.mipLevel - f32(level), f32(quad));
	indices[0].indices[0] = p_x;
	indices[0].indices[1] = p_y;
	vertices[0].vertices[0].position = vec4<f32>(getNodeCoord(uniforms.mipLevel - f32(level), f32(quad)), 0.0, 0.0);
	return;
	*/
	vertices[index].vertices[edge].position = vec4<f32>(x, y, (uniforms.mipLevel - f32(index+1)) / uniforms.mipLevel, 1.0);
	vertices[index].vertices[edge].values = vec4<f32>(levelValues[level], 0, 0, 0); 

	let i = edge;
	if(i == 0){
		indices[index].indices[0] = vIndex;
	}else if(i == 1){
		indices[index].indices[1] = vIndex;
		indices[index].indices[3] = vIndex;
	}else if(i == 2){
		indices[index].indices[2] = vIndex;
		indices[index].indices[5] = vIndex;
	}else if(i == 3){
		indices[index].indices[4] = vIndex;
	}
	state.iter[z] += 4;
}
