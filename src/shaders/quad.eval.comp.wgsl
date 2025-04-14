
struct Node {
	valueAddress: f32,
	children: vec4<f32>,	
	quad: f32,
};

fn getNode(index: u32) -> Node {
	let node: Node = Node(nodes[index * 5u],
		vec4<f32>(nodes[index * 5u + 1u], nodes[index * 5u + 2u], nodes[index * 5u + 3u], nodes[index * 5u + 4u]),
		nodes[index * 5u + 5u]
	);
	return node;
}

struct Traversal {
	depth: f32,
	address: f32,
	coord: vec2<f32>,
	boundBox: vec4<f32>,
	quad: i32,
	pad: vec3<i32>,
};

@group(0) @binding(0) var<storage, read_write> result: array<f32>;
@group(0) @binding(1) var<storage, read_write> traversal: array<Traversal>; 
@group(0) @binding(2) var<storage, read_write> quadMap: array<u32>;

@group(1) @binding(0) var<storage, read> selected: array<f32>;
@group(1) @binding(1) var<storage, read> levelValues: array<f32>;
@group(1) @binding(2) var<storage, read> nodes: array<f32>;


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

fn getNodeIndex(level: f32, pos: f32) -> u32 {
	return u32((pow(4, level + 1) - 1) / 3 + pos);
}

@compute @workgroup_size(4,4)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>,
@builtin(local_invocation_id) local_id: vec3<u32>) {
	let index = local_id.x + local_id.y * 4;

	

	//let index = local_id.x + local_id.y * 4 + global_id.z * 16;
	let boundBox = traversal[index].boundBox;
	var coord = traversal[index].coord;

	var quad = quadFromeCoord(coord, boundBox);
	var q0 = getNodeIndex(f32(traversal[index].depth), f32(quad));
	var q1 = getNodeIndex(f32(traversal[index].depth), f32((quad + 1u) % 4u));
	var q2 = getNodeIndex(f32(traversal[index].depth), f32((quad + 2u) % 4u));
	var q3 = getNodeIndex(f32(traversal[index].depth), f32((quad + 3u) % 4u));
	if (quadMap[q0] == 0u){
		quadMap[q0] = 1u;
	} else if (quadMap[q1] == 0u){
		quad = (quad + 1u) % 4u;
		quadMap[q1] = 1u;
	} else if (quadMap[q2] == 0u){
		quad = (quad + 2u) % 4u;
		quadMap[q2] = 1u;
	} else if (quadMap[q3] == 0u){
		quad = (quad + 3u) % 4u;
		quadMap[q3] = 1u;
	}
	
	//traversal[index].coord = vec2<f32>((boundBox.x + boundBox.z)/2, (boundBox.y + boundBox.w)/2);
	let nBoundBox = boundBoxFromeCoord(quad, boundBox);
	
	traversal[index+1].depth = f32(index+1);
	//traversal[index+1].address = f32(quad);
	traversal[index+1].coord = coord;
	traversal[index+1].boundBox = nBoundBox;
	traversal[index+1].quad = i32(quad);

	result[index] = abs(selected[index] - levelValues[index]);


}
