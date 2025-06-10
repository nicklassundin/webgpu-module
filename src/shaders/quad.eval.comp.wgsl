
struct Node {
valueAddress: f32,
		      children: vec4<f32>,	
		      quad: f32
};

struct Traversal {
coord: vec2<f32>,
	       address: f32,
	       done: u32
};

struct ThreadInfo {
	reference: array<f32, 16>,
		   iterations: array<u32>,

};
@group(1) @binding(1) var<storage, read_write> threadIterations: ThreadInfo; 

fn getNode(index: u32) -> Node {
	let node: Node = Node(nodes[index * 6u],
			vec4<f32>(nodes[index * 6u + 1u], nodes[index * 6u + 2u], nodes[index * 6u + 3u], nodes[index * 6u + 4u]),
			nodes[index * 6u + 5u]
			);
	return node;
}

fn quadFromCoord(uv: vec2<f32>, textDim: vec2<u32>) -> u32 {
	if(textDim.x == 1u && textDim.y == 1u) {
		return 0u;
	}
	let pixCoord = vec2<u32>(vec2<f32>(textDim) * vec2<f32>(uv.x, uv.y));
	let quadCoord = pixCoord % 2u;
	let quad = quadCoord.x *2u + quadCoord.y;
	return u32(quad);
}
fn coordFromQuad(uv_s: vec2<f32>, textDim: vec2<u32>, quad: u32) -> vec2<f32> {
	let uv = uv_s;
	let quadCoord = vec2<u32>(quad % 2u, quad / 2 );
	var pixCoord = vec2<u32>(vec2<f32>(textDim) * vec2<f32>(uv.x, uv.y));
	pixCoord = pixCoord + quadCoord;
	result[0u][5u] = f32(pixCoord.x);
	result[0u][6u] = f32(pixCoord.y);

	let coord = vec2<f32>(pixCoord) / vec2<f32>(textDim*2u);
	/*
	   result[0u][0u] = f32(quad);
	   result[0u][1u] = uv.x;
	   result[0u][2u] = uv.y;
	   result[0u][3u] = f32(quadCoord.x);
	   result[0u][4u] = f32(quadCoord.y);

	   result[0u][3u] = f32(textDim.x);
	   result[0u][4u] = f32(textDim.y);


	   result[0u][7u] = coord.x;
	   result[0u][8u] = coord.x;
	 */
	return coord; 

}

fn getLevelIndex(level: u32) -> u32 {
	//return (4**level - 1) / 3;
	return u32(pow(4.0, f32(level)) - 1.0) / 3u;
}


fn getNodeIndex(level: u32, coord: vec2<u32>) -> u32 {
	let parentIndex = getLevelIndex(level);
	let grid_size = u32(pow(2.0, f32(level)));
	let y = coord[0];
	let x = coord[1];

	let index = coord[0] * grid_size + coord[1];
	return parentIndex+index;
}

fn getValue(node: Node) -> f32 {
	return values[u32(node.valueAddress)];
}

// check quadMap level of all is done
fn checkQuadMapLevelDone(index: u32, coord: vec2<u32>) -> bool {
	for (var i = 0u; i < 4u; i = i + 1u) {
		let quad = vec2<u32>(i / 2u, i % 2u);
		let pixCoord = 2u * vec2<u32>(coord) + quad;
		let nodeIndex = getNodeIndex(index+1, pixCoord);
		/* TODO not needed
		if nodeIndex >= u32(arrayLength(quadMap)) - 1u {
			return true;
		}
		*/
		if quadMap[nodeIndex] == 0u {
			return false;
		}

	}
	return true;
}


@group(0) @binding(0) var<storage, read_write> result: array<array<f32, 16>>;
@group(0) @binding(1) var<storage, read_write> traversal: array<Traversal>; 
@group(0) @binding(2) var<storage, read_write> quadMap: array<u32>;
@group(0) @binding(3) var texture: texture_storage_2d<rgba8unorm, write>;
//@group(1) @binding(0) var<storage, read> levelValues: array<array<f32, 16>>;
@group(1) @binding(0) var<storage, read_write> levelValues: array<array<f32, 16>>;

@group(1) @binding(2) var<storage, read_write> values: array<f32>;
@group(1) @binding(3) var<storage, read_write> nodes: array<f32>;


@compute @workgroup_size(1)
	fn main(@builtin(global_invocation_id) global_id: vec3<u32>,
			@builtin(local_invocation_id) local_id: vec3<u32>) {

		let textDim = textureDimensions(texture)*2u;
		let threadIndex = local_id.x;

		let index: u32 = u32(log2(f32(textDim.x)));
		var coord = traversal[index].coord;

		let quad = quadFromCoord(coord, textDim);

		let pixCoord = vec2<u32>(vec2<f32>(textDim) * vec2<f32>(coord.x, coord.y));
		let nodeIndex = getNodeIndex(index, pixCoord);
		let trav = traversal[index];
		let addr = trav.address;

		if (quadMap[nodeIndex] == 1u || addr < 0.0){
			quadMap[nodeIndex] = 1u;
			return;
		}

		// check if outside traversal bounds (not needd for gpu)

		let node = getNode(u32(trav.address));
		let nextQuad = quadFromCoord(coord, textDim*2u);
		let children = node.children;

		var child = children[nextQuad];
		var childNodeIndex = 0u;
		var childPixCoord = vec2<u32>(0u, 0u);
		
		for (var j = 0u; j < 4u; j = j + 1u) {
			let q = (j + nextQuad) % 4u;
			child = children[q];
			let quadCoord = vec2<u32>(q / 2u, q % 2u);
			childPixCoord = 2u*pixCoord + quadCoord;

			childNodeIndex = getNodeIndex(index+1, childPixCoord);
			
			if (quadMap[childNodeIndex] == 1u) {
				continue;
			}
			if ( nextQuad == q ){
				threadIterations.reference[index] += values[u32(child)] / values[0];
			} else{
				coord = vec2<f32>(childPixCoord) / vec2<f32>(textDim*2u);
			}
			break;
		}
		//result[0u][0u] = f32(nodeIndex);
		result[0u][1u] = f32(quad);
		//result[0u][2u] = f32(childNodeIndex); 

		if(checkQuadMapLevelDone(index+1, childPixCoord)){
			traversal[0].coord = coord;
			quadMap[childNodeIndex] = 1u;
			return;
		}

		var value = getValue(node);
		if (values[u32(addr)] != 0){
			value /= values[0u];
		}
		if child < 0.0 {
			value = 0.0;
		}
		if (value == 0.0) {
			quadMap[nodeIndex] = 1u;
		}
		result[0u][3u] = value;

		let color = vec4<f32>(1.0 - value, f32(quad+1u)/4.0, 1.0 - f32(index)/10, 1.0);
		let textCoord = vec2<u32>(vec2<f32>(textDim) * vec2<f32>(coord.x, coord.y));
		textureStore(texture, textCoord, color);

		if (checkQuadMapLevelDone(index, pixCoord)){
			quadMap[nodeIndex] = 1u;
		}
		traversal[index+1].address = child;
		traversal[index+1].coord = coord;
		traversal[0].coord = coord;
	}
