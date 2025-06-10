import json
import math
from matplotlib.widgets import Button
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D
import numpy as np

JSON_FILE = "../public/data/obs/quadtree_Phylloscopus_collybita.json"
# read the JSON file
with open(JSON_FILE, "r") as file:
    raw = json.load(file)
    data = json.loads(raw)

nodes = data["nodes"]
values = data["values"]

# node structure
class Node:
    def __init__(self, valueAddr: int, children: [int], quad: int = 0): 
        self.valueAddr = valueAddr
        self.children = children
        self.quad = quad

# enumerate data by 6 at a time
node_buffer = []
for i in range(0, len(nodes), 6):
    valueAddr = nodes[i]
    children = nodes[i + 1:i + 5]
    quad = nodes[i + 5]
    node_buffer.append(Node(valueAddr, children, quad))


class Trav:
    def __init__(self, coord: [float, float], addr: int, done: int, mipLevel: int):
        self.coord = coord
        self.addr = addr
        self.done = done
        self.mipLevel = mipLevel

# calculate max mipmap level
MAX_DIMENSION = 256
MAX_DIMENSION = MAX_DIMENSION / 8
# MAX_DIMENSION = MAX_DIMENSION / 32
# MAX_DIMENSION = MAX_DIMENSION / 64
MAX_DIMENSION = int(MAX_DIMENSION)
maxMipMapLevel = int(math.log2(MAX_DIMENSION));
print("Max Mipmap Level:", maxMipMapLevel)

def initImages(maxMipMapLevel: int) -> [[int]]:
    images: [[int]] = []
    for i in range(maxMipMapLevel):
        dim = pow(2, maxMipMapLevel - i)
        image = [[0 for _ in range(dim)] for _ in range(dim)]
        image = np.array(image, dtype=float)
        rgba_image = plt.cm.gray(image)
        # set alpha
        rgba_image[..., -1] = 0.0
        images.append(rgba_image)
    return images

images = initImages(maxMipMapLevel)



traversal: [Trav] = []
initTrav = Trav([0.80, 0.6], 0, 1, maxMipMapLevel)
traversal.append(initTrav)
# append 10 empty traversal
for i in range(maxMipMapLevel):
    empty_traversal = Trav([0, 0], 0, 0, maxMipMapLevel - i - 1)
    traversal.append(empty_traversal)


def getSizeOfLevel(level: int) -> int:
    return int(math.pow(4, level))

# print("Size of Levels:")
# print(getSizeOfLevel(0))
# print(getSizeOfLevel(1))
# print(getSizeOfLevel(2))

def getLevelIndex(level: int) -> int:
    return (4**level - 1) // 3

print("Level Index:")
print(getLevelIndex(0))
print(getLevelIndex(1))
print(getLevelIndex(2))


def getNodeIndex(level: int, coord: [int, int]) -> int:
    parentIndex = getLevelIndex(level)
    grid_size = 2 ** level
    x = coord[0]
    y = coord[1]

    index = coord[0]*grid_size + coord[1]
    return parentIndex+index

# print("Node Index:")

# print("Level 0")
# print(getNodeIndex(0, [0, 0]))
# print("Level 1")
# print(getNodeIndex(1, [0, 0]))
# print(getNodeIndex(1, [0, 1]))
# print(getNodeIndex(1, [1, 0]))
# print(getNodeIndex(1, [1, 1]))
# print("Level 2:0")
# print(getNodeIndex(2, [0, 0]))
# print(getNodeIndex(2, [0, 1]))
# print(getNodeIndex(2, [0, 2]))
# print(getNodeIndex(2, [0, 3]))
# print("Level 2:1")
# print(getNodeIndex(2, [1, 0]))
# print(getNodeIndex(2, [1, 1]))
# print(getNodeIndex(2, [1, 2]))
# print(getNodeIndex(2, [1, 3]))
# print("Level 2:2")
# print(getNodeIndex(2, [2, 0]))
# print(getNodeIndex(2, [2, 1]))
# print(getNodeIndex(2, [2, 2]))
# print(getNodeIndex(2, [2, 3]))
# print("Level 2:3")
# print(getNodeIndex(2, [3, 1]))
# print(getNodeIndex(2, [3, 0]))
# print(getNodeIndex(2, [3, 2]))
# print(getNodeIndex(2, [3, 3]))
# print("Level 3")
# print(getNodeIndex(2, [3,3]))
# exit()

def quadFromCoord(coord: [float, float], textDim: [int, int]) -> int:
    if(textDim[0] == 1 and textDim[1] == 1):
        return 0
    pixCoord = [int(coord[0] * textDim[0]), int(coord[1] * textDim[1])]
    quadCoord = [pixCoord[0] % 2, pixCoord[1] % 2]
    quad = quadCoord[0] * 2 + quadCoord[1]
    return quad

def colorImage(coord: [int, int], depth: int, value: float = 0.0):
    # print("Coloring")
    mipLevel = maxMipMapLevel - depth
    image = images[mipLevel] 
    # print(mipLevel, "image shape:", image.shape)
    # print(mipLevel, "uv:", uv)
    x = coord[0];
    y = coord[1]; 
    # image[y][x][0,...] = 0.3;
    if(value > 0):
        image[y][x][1,...] = value;
        image[y][x][3,...] = 0.6;
    else:
        image[y][x][0,...] = 1.0;
        image[y][x][3,...] = 0.2;

    # print(mipLevel, uv, image[y][x])

# size of each mipmap level for quadtree
quadTreeSize = math.pow(4, maxMipMapLevel);
quadTreeSizeBottom = math.pow(4, maxMipMapLevel + 1) - quadTreeSize;
quadMap: [bool] = [False] * int(quadTreeSize) + [True] * int(quadTreeSizeBottom)


print("Quad Map Size:", len(quadMap))


def getChildNodeIndex(index: int, coord: [int, int], q: int ) -> int:
    quadCoord = np.array([q // 2, q % 2])
    pixCoord = np.array([coord[0] * 2, coord[1] * 2]) + quadCoord
    nodeIndex = getNodeIndex(index + 1, pixCoord)
    return nodeIndex

def checkQuadMapLevelDone(index: int, coord: [int, int]) -> bool:
    for i in range(0, 4):
        nodeIndex = getChildNodeIndex(index, coord, i) 
        if nodeIndex >= len(quadMap)+1:
            return True
        if not quadMap[nodeIndex]:
            return False
    return True

# test checkQUadMapLevelDone
# quadMap[1] = True
# quadMap[2] = True
# quadMap[3] = True
# quadMap[4] = True
# print("Quad Map Level Done:", checkQuadMapLevelDone(0, [0, 0]))
# quadMap[5] = True
# quadMap[6] = True
# quadMap[7] = True
# quadMap[8] = True
# print("Quad Map Level 1: q: 0:", checkQuadMapLevelDone(1, [0, 0]))
# quadMap[9] = True
# quadMap[10] = True
# quadMap[11] = True
# quadMap[12] = True
# print("Quad Map Level 1: q: 1", checkQuadMapLevelDone(1, [1, 0]))
# print("Quad Map Level 1; q: 2", checkQuadMapLevelDone(1, [0, 1]))
# print("Quad Map Level 1; q: 3", checkQuadMapLevelDone(1, [1, 1]))
# print(quadMap[0])
# print(quadMap[1:5])
# print(quadMap[5:21])
# exit()


def coordFromQuad(uv: [float, float], textDim: [int, int], quad: int) -> [float, float]:
    uv = np.array(uv)
    
    textDim = np.array(textDim)
    quadCoord = np.array([quad // 2, quad % 2])
    pixCoord = textDim * uv;
    # pix rounding
    pixCoord = np.floor(pixCoord).astype(int)
    pixCoord = 2*pixCoord + quadCoord + 0.5;

    coord = pixCoord / (textDim*2)
    return coord;


# reference values length mipmax level
reference: [int] = [0 for _ in range(maxMipMapLevel + 1)]

def traversData():
    print("Traverse data")
    for i, trav in enumerate(traversal):
        dim = pow(2, maxMipMapLevel - trav.mipLevel)
        index = int(math.log2(dim));
        textDim = np.array([dim, dim])
        coord = trav.coord
        quad = quadFromCoord(coord, textDim)
        pixCoord = np.array([int(coord[0] * textDim[0]), int(coord[1] * textDim[1])])
        nodeIndex = getNodeIndex(index, pixCoord)
        addr = trav.addr
        
        quadMap[nodeIndex] = True
        print(i+1,"/",len(traversal), coord)
        if (i == len(traversal) - 1):
            traversal[0].coord = coord
            continue

    

        
        node = node_buffer[addr]
        nextQuad = quadFromCoord(coord, textDim*2)
        children = node.children


        # TODO check such at nextQuad realy is right
        # reorder children to 0,2,3,1 
        child = children[nextQuad]
        # iterate over quad
        
        # print("Children:")
        for j in range(0, 4):
            q = (j + nextQuad) % 4
            child = children[q]
            quadCoord = np.array([q // 2, q % 2])
            childPixCoord = [2*pixCoord[0], 2*pixCoord[1]] + quadCoord
            childNodeIndex = getNodeIndex(index + 1, childPixCoord) 

            if (q != nextQuad):
                coord = childPixCoord / (textDim * 2)

            if (quadMap[childNodeIndex] and checkQuadMapLevelDone(index+1, childPixCoord) or values[child] == 0):
                print("Skipping child:", index+2, childPixCoord, quadMap[childNodeIndex]);
                continue

            break;

        value = values[child];
        
        if(values[addr] != 0):
            value /= values[addr];
        if child < 0:
            value = 0.0;

        # if value > 1.0:
        #     print("child", child)
        #     print("addr", addr)
        #     value = 0.1;
        colorImage(childPixCoord, index+1, value)


        traversal[i+1].addr = child
        traversal[i+1].coord = coord;
        traversal[0].coord = coord
        # quadMap[childNodeIndex] = True
        # print(coord)



traversData()

def getImageData(rgba_image, prev_image=None, i=0):
    dim = len(rgba_image)
    x = np.linspace(0, 1, dim+pow(i, 0))
    y = np.linspace(0, 1, dim+pow(i, 0))
    X, Y = np.meshgrid(x, y)
    Z = np.ones_like(X) * i  # Mipmap level as Z value
    # Convert to RGBA format
    # rgba_image = plt.cm.gray(image)
    # set alpha
    # merge previous rgba_image with current image
    if prev_image is not None:
        rgba_image = np.maximum(rgba_image, prev_image)
    return X, Y, Z, rgba_image

# print all images above eachother like a mipmaplevel in 3D plot
fig = plt.figure(figsize=(10, 10))
ax = fig.add_subplot(111, projection='3d')


def fillRGBA(images):
    surfaces = []
    rgba_images = []
    for i, image in enumerate(images):
        max_value = np.max(image)
        min_value = np.min(image)
        # print(f"Image {i} - Max: {np.max(image)}, Min: {np.min(image)}")
        # print(f"Image {i} - Shape: {image.shape}")
        # stop if values is outside 0-1
        # if max_value > 1 or min_value < 0:
            # print(f"Image {i} has values outside 0-1 range. Skipping.")
            # break;
        X, Y, Z, rgba_image = getImageData(image, None, i)
        # print max and min value of rgba_image
        rgba_images.append(rgba_image)
        # Plot the surface with the RGBA image
        # ax.plot_surface(X, Y, Z, rstride=1, cstride=1, facecolors=rgba_image, shade=False)
        surface = ax.plot_surface(X, Y, Z, rstride=1, cstride=1, facecolors=rgba_image, shade=False)
        surfaces.append(surface)

    return surfaces, rgba_images


surfaces, rgba_images = fillRGBA(images)


num_lines = 0;
def drawLine(ax):
    global num_lines
    pn = np.array([traversal[0].coord[0], traversal[0].coord[1]])
    p0 = np.array([pn[0], pn[1], 0])  # Start point at mipmap level 0
    p1 = np.array([pn[0], pn[1], maxMipMapLevel])  # End point at max mipmap level
    # plot as line between the points
    ax.plot([p0[0], p1[0]], [p0[1], p1[1]], [p0[2], p1[2]], color='red', linewidth=2, label='Traversal Path')
    ax.text(pn[0], pn[1], maxMipMapLevel + 0.1, f'Line: {num_lines}', color='red', fontsize=10)
    num_lines = num_lines + 1

def setupPlot():
    drawLine(ax)

    ax.set_xlabel('X')
    ax.set_ylabel('Y')
    ax.set_zlabel('MipMap Level')
    # scale the z-axis to show the mipmap levels
    ax.set_zlim(0, maxMipMapLevel)
    plt.title('3D Mipmap Levels')

setupPlot()



def drawSurface(images):
    for coll in ax.collections:
            coll.remove()
    surfaces, rgba_images = fillRGBA(images)
    fig.canvas.draw_idle()
    print("Redrawing surface with updated images")



def update(event):
    # Update the y data
    traversData()
    drawLine(ax)
    drawSurface(images)


ax_button = plt.axes([0.4, 0.1, 0.2, 0.075])  # [left, bottom, width, height]
btn = Button(ax_button, 'Update')

btn.on_clicked(update)

# add toggle button to update n times
toggle_ax = plt.axes([0.65, 0.1, 0.2, 0.075])  # [left, bottom, width, height]
toggle_button = Button(toggle_ax, 'Toggle Update')
# slider between 0 and 100 
slider_ax = plt.axes([0.4, 0.0, 0.3, 0.075])  # [left, bottom, width, height]
slider = plt.Slider(slider_ax, 'Count', 0, 1000, valinit=100, valfmt='%0.0f')

# slide for MAX_DIMENSION reset images if changed
maxDim_slider_ax = plt.axes([0.75, 0.0, 0.2, 0.075])  # [left, bottom, width, height]
maxDim_slider = plt.Slider(maxDim_slider_ax, 'Max Dimension', 32, 128, valstep=[16, 32, 64, 128], valinit=MAX_DIMENSION, valfmt='%0.0f')
def resetImages(event):
    global MAX_DIMENSION, maxMipMapLevel, images
    MAX_DIMENSION = int(maxDim_slider.val)
    maxMipMapLevel = int(math.log2(MAX_DIMENSION))
    print("Max Mipmap Level:", maxMipMapLevel)
    images = initImages(maxMipMapLevel)
    # reset traversal
    global traversal
    traversal = [Trav([0.80, 0.6], 0, 1, maxMipMapLevel)]
    for i in range(maxMipMapLevel):
        empty_traversal = Trav([0, 0], 0, 0, maxMipMapLevel - i - 1)
        traversal.append(empty_traversal)

    quadMap = [False] * int(math.pow(4, maxMipMapLevel + 1))

    traversData()

    setupPlot()
    surfaces, rgba_images = fillRGBA(images) 
    drawSurface(images)
    print("Max Mipmap Level reset to:", maxMipMapLevel)
    print("Quad Map Size:", len(quadMap))
    print("Max Mipmap Level reset to:", maxMipMapLevel)
maxDim_slider.on_changed(resetImages)
    



total = 0;
for i, image in enumerate(images):
    total += np.sum(image)
def multiCall(count: int = 0):
    global total
    if count < slider.val:
        # print("Count:",count, "/", slider.val)
        traversData()
        multiCall(count + 1)
    else:
        drawSurface(images)
    
    # sum all values in all images
    total = 0
    for i, image in enumerate(images):
        total += np.sum(image)

def toggle_update(event):
    previous_total = total
    multiCall()
    print("diff:", total - previous_total)


        
toggle_button.on_clicked(toggle_update)




plt.show()


# clean up on exit
def on_close(event):
    plt.close(fig)
