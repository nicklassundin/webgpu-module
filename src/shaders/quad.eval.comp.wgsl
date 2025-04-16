
struct Node {
	valueAddress: f32,
	children: vec4<f32>,	
	quad: f32,
};

struct Traversal {
	depth: f32,
	address: f32,
	coord: vec2<f32>,
	boundBox: vec4<f32>,
	quad: i32,
	pad: vec3<i32>,
};

@group(0) @binding(0) var<storage, read_write> result: array<array<f32, 16>>;
@group(0) @binding(1) var<storage, read_write> traversal: array<Traversal>; 
@group(0) @binding(2) var<storage, read_write> quadMap: array<u32>;



@group(1) @binding(0) var<storage, read> levelValues: array<array<f32, 16>>;


fn quadFromeCoord(uv: vec2<f32>, boundBox: vec4<f32>) -> u32 {
	var coord = uv;
	// normalize in boundBox
	coord.x = (coord.x - boundBox.x) / (boundBox.z - boundBox.x);
	coord.y = (coord.y - boundBox.y) / (boundBox.w - boundBox.y);
	// convert to 0 or 1
	coord.x = step(0.5, coord.x);
	coord.y = step(0.5, coord.y);
	// quad
	let quad = u32(coord.x + coord.y * 2.0);
	return u32(quad);
}

fn boundBoxFromeCoord(quad: u32, boundBox: vec4<f32>) -> vec4<f32> {
	// new boundbox
	var nBoundBox = vec4<f32>(0.0, 0.0, 0.0, 0.0);
	let center = (boundBox.xy + boundBox.zw) * 0.5;
	if (quad == 0u){
		nBoundBox = vec4<f32>(boundBox.x, boundBox.y, center.x, center.y);
	} else if (quad == 1u){
		nBoundBox = vec4<f32>(center.x, boundBox.y, boundBox.z, center.y);
	} else if (quad == 2u){
		nBoundBox = vec4<f32>(boundBox.x, center.y, center.x, boundBox.w);
	} else if (quad == 3u){
		nBoundBox = vec4<f32>(center.x, center.y, boundBox.z, boundBox.w);
	}
	return nBoundBox;
}

const PI: f32 = 3.14159265358979323846;

fn getNodeIndex(level: f32, pos: f32) -> u32 {
	return u32((pow(4, level)) / 3 + pos);
}
const rotateMatrix = mat2x2<f32>(cos(PI / 2.0), -sin(PI / 2.0), sin(PI / 2.0), cos(PI / 2.0));
fn turnCoord(quad: u32, coord: vec2<f32>) -> vec2<f32> {
	let q = f32(quad);
	var nCoord = coord*2.0 - 1.0;
	// rotate matrix
	
	nCoord = nCoord*rotateMatrix;
	nCoord = nCoord * 0.5 + 0.5;
	return nCoord;
}

@compute @workgroup_size(4,4)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>,
@builtin(local_invocation_id) local_id: vec3<u32>) {
	let index = local_id.x + local_id.y * 4;
	//let index = local_id.x + local_id.y * 4 + global_id.z*17;
	let boundBox = traversal[index].boundBox;
	let center = (boundBox.xy + boundBox.zw) * 0.5;
	var coord = traversal[index].coord;
	traversal[index].depth = f32(local_id.x + local_id.y * 4);
	let depth = traversal[index].depth;
	
	var quad = quadFromeCoord(coord, boundBox);
	var q0 = getNodeIndex(f32(depth), f32(quad));
	var q1 = getNodeIndex(f32(depth), f32((quad + 1u) % 4u));
	var q2 = getNodeIndex(f32(depth), f32((quad + 2u) % 4u));
	var q3 = getNodeIndex(f32(depth), f32((quad + 3u) % 4u));
	if (quadMap[q0] == 0u){
		quadMap[q0] = 1u;
	} else if (quadMap[q1] == 0u){
		quad = (quad + 1u) % 4u;
		quadMap[q1] = 1u;
	} else if (quadMap[q2] == 0u){
		quad = (quad + 2u) % 4u;
		quadMap[q2] += 1u;
	} else if (quadMap[q3] == 0u){
		quad = (quad + 3u) % 4u;
		quadMap[q3] = 1u; 
	}
	
	let nBoundBox = boundBoxFromeCoord(quad, boundBox);
	let nIndex = index + 1;
	
	traversal[nIndex].depth = f32(depth+1);
	traversal[nIndex].coord = coord;
	traversal[nIndex].boundBox = nBoundBox;

	result[global_id.x / 16u][index] = abs(levelValues[0][index] - levelValues[global_id.x / 16u][index]);
	coord = turnCoord(1u, coord);
	traversal[index+17].coord = coord;
	traversal[index+17].quad = i32(quad);
	traversal[index+17].boundBox = boundBox;
	traversal[index+17].depth = f32(depth);



}
