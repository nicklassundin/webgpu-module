
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
//@group(0) @binding(1) var<storage, read_write> indices: array<u32>;
@group(0) @binding(2) var<storage, read_write> state: State;
@group(1) @binding(0) var<storage, read> levelValues: array<f32>;
@group(1) @binding(1) var<storage, read> traversal: array<Traversal>; 
@group(1) @binding(2) var<uniform> uniforms: Uniforms; 

// texture
@group(2) @binding(0) var texture: texture_2d<f32>;

fn getNodeIndex(level: f32, pos: f32) -> u32 {
	return u32((pow(4, level)) / 3 + pos);
}
fn modf(a: f32, b: f32) -> f32 {
    return a - b * floor(a / b);
}


@compute @workgroup_size(2,2)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>,
@builtin(local_invocation_id) local_id: vec3<u32>) {
	//let index = global_id.z % u32(uniforms.mipLevel);
	let index = global_id.z;
	let e = local_id.x + local_id.y * 2;
	let level: u32 = u32(traversal[index].depth);
	let grid: f32 = pow(2.0, f32(level));
	
	//var coord = traversal[0].coord;
	let coord = traversal[index].coord;

	let pixCoord = coord*grid;
	
	let p_x = u32(pixCoord.x);
	let p_y = u32(pixCoord.y);

	var x = f32(p_x+local_id.x) / grid;
	var y = f32(p_y+local_id.y) / grid;
	

	// TODO fix so flat indexing
	let quad = traversal[index].quad;
	let vIndex = getNodeIndex(f32(level), f32(quad));
	if (((uniforms.mipLevel - f32(index+1))/uniforms.mipLevel) < 0.0){

	}else{
		vertices[vIndex].vertices[e].position = vec4<f32>(x, y, (uniforms.mipLevel - f32(level+1)) / uniforms.mipLevel, 1.0);
		vertices[vIndex].vertices[e].values = vec4<f32>(levelValues[level], 0, 0, 0); 
	}
	
	let j = vIndex;
	let i = e; 
	let k = (vIndex+e)*6;
	if(i == 0){
		indices[j].indices[0] = vIndex*4+e;
	}else if(i == 1){
		indices[j].indices[1] = vIndex*4+e;
		indices[j].indices[3] = vIndex*4+e;
	}else if(i == 2){
		indices[j].indices[2] = vIndex*4+e;
		indices[j].indices[5] = vIndex*4+e;
	}else if(i == 3){
		indices[j].indices[4] = vIndex*4+e;
	}
}
